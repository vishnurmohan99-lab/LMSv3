import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';

export type ReportRange = 'RANGE_30' | 'QUARTER' | 'YTD' | 'ALL';

export interface SegmentReportRow {
  segmentId: string;
  name: string;
  students: number;
  enrollments: number;
  completions: number;
  avgScore: number | null;
}

const SCORE_BUCKETS = ['0-20', '21-40', '41-60', '61-80', '81-100'];

const MS_PER_DAY = 86_400_000;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TREND_LABEL: Record<ReportRange, string> = {
  RANGE_30: 'Enrollments — last 30 days',
  QUARTER: 'Enrollments — last quarter',
  YTD: 'Enrollments — year to date',
  ALL: 'Enrollments — last 6 months',
};

function bucketForPct(pct: number) {
  if (pct <= 20) return 0;
  if (pct <= 40) return 1;
  if (pct <= 60) return 2;
  if (pct <= 80) return 3;
  return 4;
}

// Bucket keys are built in UTC so the report reads the same on a UTC host and a
// dev box in another timezone.
function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function dayKey(date: Date) {
  return `${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Start of the reporting window, or null for "all time". Boundaries are UTC. */
  private rangeStart(range: ReportRange, now: Date): Date | null {
    if (range === 'RANGE_30') return new Date(now.getTime() - 30 * MS_PER_DAY);
    if (range === 'QUARTER') return new Date(now.getTime() - 90 * MS_PER_DAY);
    if (range === 'YTD') return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return null;
  }

  /**
   * Buckets that actually cover the selected window, so the chart never shows
   * empty months the range was never going to include.
   */
  private buildTrend(range: ReportRange, from: Date | null, now: Date, enrolledAt: Date[]) {
    const buckets: { period: string; start: number; end: number }[] = [];

    if (from && (range === 'RANGE_30' || range === 'QUARTER')) {
      const spanDays = range === 'RANGE_30' ? 5 : 15; // six bars either way
      for (let i = 0; i < 6; i++) {
        const start = from.getTime() + i * spanDays * MS_PER_DAY;
        buckets.push({ period: dayKey(new Date(start)), start, end: start + spanDays * MS_PER_DAY });
      }
      // Rounding can leave the window short of "now"; stretch the last bucket so
      // an enrollment from a minute ago is never dropped off the chart.
      buckets[buckets.length - 1].end = Math.max(buckets[buckets.length - 1].end, now.getTime() + 1);
    } else {
      const months = range === 'YTD' ? now.getUTCMonth() + 1 : 6;
      for (let i = months - 1; i >= 0; i--) {
        const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
        buckets.push({
          period: monthKey(new Date(start)),
          start,
          end: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1),
        });
      }
    }

    const counts = new Array<number>(buckets.length).fill(0);
    for (const d of enrolledAt) {
      const t = d.getTime();
      const i = buckets.findIndex((b) => t >= b.start && t < b.end);
      if (i >= 0) counts[i]++;
    }
    return buckets.map((b, i) => ({ period: b.period, count: counts[i] }));
  }

  /**
   * Per-segment rollup for the admin Reports table. Aggregated in Postgres — the
   * inputs (every lesson view on the platform) are far too large to join in Node.
   *
   * Each column counts events inside the window: enrollments/students by enrolment
   * date, completions by the date the student viewed the course's final lesson,
   * average score by submission date. Courses with no segment roll up into a
   * synthetic "Unassigned" row so the columns reconcile with the totals tiles.
   */
  private async getSegmentBreakdown(from: Date | null): Promise<SegmentReportRow[]> {
    const p = from ? from.toISOString() : null;
    return this.prisma.$queryRaw<SegmentReportRow[]>`
      WITH lesson_counts AS (
        SELECT ch."courseId" AS course_id, COUNT(*)::int AS total_lessons
        FROM "Lesson" l
        JOIN "Chapter" ch ON ch.id = l."chapterId"
        GROUP BY ch."courseId"
      ),
      course_seg AS (
        SELECT c.id AS course_id, c."segmentId" AS segment_id, COALESCE(lc.total_lessons, 0) AS total_lessons
        FROM "Course" c
        LEFT JOIN lesson_counts lc ON lc.course_id = c.id
      ),
      enr_agg AS (
        SELECT cs.segment_id,
               COUNT(*)::int AS enrollments,
               COUNT(DISTINCT e."studentId")::int AS students
        FROM "Enrollment" e
        JOIN course_seg cs ON cs.course_id = e."courseId"
        WHERE (${p}::timestamp IS NULL OR e."enrolledAt" >= ${p}::timestamp)
        GROUP BY cs.segment_id
      ),
      course_progress AS (
        SELECT v."studentId" AS student_id,
               ch."courseId" AS course_id,
               COUNT(DISTINCT v."lessonId")::int AS viewed,
               MAX(v."viewedAt") AS finished_at
        FROM "LessonView" v
        JOIN "Lesson" l ON l.id = v."lessonId"
        JOIN "Chapter" ch ON ch.id = l."chapterId"
        GROUP BY v."studentId", ch."courseId"
      ),
      comp_agg AS (
        SELECT cs.segment_id, COUNT(*)::int AS completions
        FROM "Enrollment" e
        JOIN course_seg cs ON cs.course_id = e."courseId"
        JOIN course_progress cp ON cp.student_id = e."studentId" AND cp.course_id = e."courseId"
        WHERE cs.total_lessons > 0
          AND cp.viewed >= cs.total_lessons
          AND (${p}::timestamp IS NULL OR cp.finished_at >= ${p}::timestamp)
        GROUP BY cs.segment_id
      ),
      score_agg AS (
        SELECT cs.segment_id, ROUND(AVG(a.score::numeric * 100 / a."maxScore"), 1)::float8 AS avg_score
        FROM "TestAttempt" a
        JOIN "Test" t ON t.id = a."testId"
        JOIN course_seg cs ON cs.course_id = t."courseId"
        WHERE a.status = 'SUBMITTED'
          AND a.score IS NOT NULL
          AND a."maxScore" IS NOT NULL
          AND a."maxScore" > 0
          AND (${p}::timestamp IS NULL OR a."submittedAt" >= ${p}::timestamp)
        GROUP BY cs.segment_id
      ),
      seg_ids AS (
        SELECT id AS segment_id FROM "Segment"
        UNION ALL
        SELECT NULL::text WHERE EXISTS (SELECT 1 FROM "Course" WHERE "segmentId" IS NULL)
      )
      SELECT COALESCE(si.segment_id, '__unassigned__') AS "segmentId",
             COALESCE(s.name, 'Unassigned') AS "name",
             COALESCE(ea.students, 0) AS "students",
             COALESCE(ea.enrollments, 0) AS "enrollments",
             COALESCE(ca.completions, 0) AS "completions",
             sa.avg_score AS "avgScore"
      FROM seg_ids si
      LEFT JOIN "Segment" s ON s.id = si.segment_id
      LEFT JOIN enr_agg ea ON ea.segment_id IS NOT DISTINCT FROM si.segment_id
      LEFT JOIN comp_agg ca ON ca.segment_id IS NOT DISTINCT FROM si.segment_id
      LEFT JOIN score_agg sa ON sa.segment_id IS NOT DISTINCT FROM si.segment_id
      ORDER BY "enrollments" DESC, "name" ASC
    `;
  }

  async getAdminReport(range: ReportRange = 'ALL') {
    const now = new Date();
    const from = this.rangeStart(range, now);
    const [enrollments, attempts, batches, courseCount, batchCount, segmentBreakdown] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: from ? { enrolledAt: { gte: from } } : {},
        select: { enrolledAt: true },
      }),
      this.prisma.testAttempt.findMany({
        where: {
          status: 'SUBMITTED',
          score: { not: null },
          maxScore: { not: null },
          test: { courseId: { not: null } },
          ...(from ? { submittedAt: { gte: from } } : {}),
        },
        select: { score: true, maxScore: true },
      }),
      this.prisma.batch.findMany({ select: { status: { select: { isCompletionTarget: true } } } }),
      this.prisma.course.count(),
      this.prisma.batch.count(),
      this.getSegmentBreakdown(from),
    ]);

    const enrollmentTrend = this.buildTrend(range, from, now, enrollments.map((e) => e.enrolledAt));

    const distCounts = [0, 0, 0, 0, 0];
    for (const a of attempts) {
      const pct = ((a.score ?? 0) / (a.maxScore || 1)) * 100;
      distCounts[bucketForPct(pct)]++;
    }
    const scoreDistribution = SCORE_BUCKETS.map((bucket, i) => ({ bucket, count: distCounts[i] }));

    const completedBatches = batches.filter((b) => b.status.isCompletionTarget).length;

    return {
      enrollmentTrend,
      trendLabel: TREND_LABEL[range],
      scoreDistribution,
      batchCompletion: { completed: completedBatches, total: batches.length, rate: batches.length ? completedBatches / batches.length : 0 },
      totals: { totalCourses: courseCount, totalBatches: batchCount, totalMockTestAttempts: attempts.length, totalEnrollments: enrollments.length },
      segmentBreakdown,
      range,
    };
  }

  async getFacultyReport(faculty: JwtPayload) {
    const courses = await this.prisma.course.findMany({
      where: { facultyId: faculty.sub },
      include: {
        enrollments: { include: { student: { select: { id: true, fullName: true, email: true } } } },
        mockTests: { where: { courseId: { not: null } } },
      },
      orderBy: { title: 'asc' },
    });

    const result: {
      courseId: string;
      title: string;
      enrollmentCount: number;
      batches: { id: string; name: string; status: string; enrolledCount: number }[];
      mockTestCount: number;
      students: { id: string; fullName: string; email: string; enrolledAt: Date; bestScorePct: number | null; attemptCount: number }[];
    }[] = [];
    for (const course of courses) {
      const batches = await this.prisma.batch.findMany({
        where: { OR: [...(course.segmentId ? [{ segmentId: course.segmentId }] : []), ...(course.subsegmentId ? [{ subsegmentId: course.subsegmentId }] : [])] },
        include: { status: true, _count: { select: { enrollments: true } } },
      });
      const mockTestIds = course.mockTests.map((t) => t.id);
      const attempts = mockTestIds.length
        ? await this.prisma.testAttempt.findMany({
            where: { testId: { in: mockTestIds }, status: 'SUBMITTED', score: { not: null }, maxScore: { not: null } },
            select: { studentId: true, score: true, maxScore: true },
          })
        : [];

      const byStudent = new Map<string, { best: number; attempts: number }>();
      for (const a of attempts) {
        const pct = ((a.score ?? 0) / (a.maxScore || 1)) * 100;
        const existing = byStudent.get(a.studentId);
        if (!existing) byStudent.set(a.studentId, { best: pct, attempts: 1 });
        else byStudent.set(a.studentId, { best: Math.max(existing.best, pct), attempts: existing.attempts + 1 });
      }

      result.push({
        courseId: course.id,
        title: course.title,
        enrollmentCount: course.enrollments.length,
        batches: batches.map((b) => ({ id: b.id, name: b.name, status: b.status.name, enrolledCount: b._count.enrollments })),
        mockTestCount: course.mockTests.length,
        students: course.enrollments.map((e) => ({
          id: e.student.id,
          fullName: e.student.fullName,
          email: e.student.email,
          enrolledAt: e.enrolledAt,
          bestScorePct: byStudent.get(e.student.id)?.best ?? null,
          attemptCount: byStudent.get(e.student.id)?.attempts ?? 0,
        })),
      });
    }

    return result;
  }
}
