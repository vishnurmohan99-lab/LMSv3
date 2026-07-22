import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';

export type ReportRange = 'RANGE_30' | 'QUARTER' | 'YTD' | 'ALL';

export interface SegmentReportRow {
  /** Null for the synthetic "courses with no segment" row — see `isUnassigned`. */
  segmentId: string | null;
  name: string;
  isUnassigned: boolean;
  students: number;
  enrollments: number;
  completions: number;
  avgScore: number | null;
}

interface TrendBucket {
  period: string;
  start: number;
  end: number;
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

// Bucket keys are built in UTC so the report reads the same on a UTC host and a
// dev box in another timezone.
function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function dayKey(date: Date, withYear: boolean) {
  const base = `${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`;
  return withYear ? `${base} '${String(date.getUTCFullYear()).slice(-2)}` : base;
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
   * empty months the range was never going to include. Built before the query so
   * the enrolment fetch can be narrowed to the span the chart will draw.
   */
  private buildBuckets(range: ReportRange, from: Date | null, now: Date): TrendBucket[] {
    if (from && (range === 'RANGE_30' || range === 'QUARTER')) {
      const spanDays = range === 'RANGE_30' ? 5 : 15; // six bars either way
      const spans: { start: number; end: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const start = from.getTime() + i * spanDays * MS_PER_DAY;
        spans.push({ start, end: start + spanDays * MS_PER_DAY });
      }
      // Rounding can leave the window short of "now"; stretch the last bucket so
      // an enrollment from a minute ago is never dropped off the chart.
      spans[spans.length - 1].end = Math.max(spans[spans.length - 1].end, now.getTime() + 1);
      // A quarter can straddle New Year, and "Dec 29" next to "Jan 13" reads as
      // out of order without the year.
      const spansYears =
        new Date(spans[0].start).getUTCFullYear() !== new Date(spans[spans.length - 1].start).getUTCFullYear();
      return spans.map((s) => ({ period: dayKey(new Date(s.start), spansYears), start: s.start, end: s.end }));
    }

    const months = range === 'YTD' ? now.getUTCMonth() + 1 : 6;
    const buckets: TrendBucket[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
      buckets.push({
        period: monthKey(new Date(start)),
        start,
        end: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1),
      });
    }
    return buckets;
  }

  private countIntoBuckets(buckets: TrendBucket[], enrolledAt: Date[]) {
    const counts = new Array<number>(buckets.length).fill(0);
    for (const d of enrolledAt) {
      const t = d.getTime();
      const i = buckets.findIndex((b) => t >= b.start && t < b.end);
      if (i >= 0) counts[i]++;
    }
    return buckets.map((b, i) => ({ period: b.period, count: counts[i] }));
  }

  /**
   * Score histogram, bucketed in Postgres. Loading every submitted attempt into Node
   * to produce five integers grew without bound — attempts are never pruned.
   * Boundaries match the old bucketForPct exactly: <=20, <=40, <=60, <=80, else.
   */
  private async getScoreHistogram(from: Date | null) {
    const p = from ? from.toISOString() : null;
    const [row] = await this.prisma.$queryRaw<
      { b0: number; b1: number; b2: number; b3: number; b4: number; total: number }[]
    >`
      SELECT COUNT(*) FILTER (WHERE pct <= 20)::int AS "b0",
             COUNT(*) FILTER (WHERE pct > 20 AND pct <= 40)::int AS "b1",
             COUNT(*) FILTER (WHERE pct > 40 AND pct <= 60)::int AS "b2",
             COUNT(*) FILTER (WHERE pct > 60 AND pct <= 80)::int AS "b3",
             COUNT(*) FILTER (WHERE pct > 80)::int AS "b4",
             COUNT(*)::int AS "total"
      FROM (
        SELECT a.score::numeric * 100 / a."maxScore" AS pct
        FROM "TestAttempt" a
        JOIN "Test" t ON t.id = a."testId"
        WHERE a.status = 'SUBMITTED'
          AND a.score IS NOT NULL
          AND a."maxScore" > 0
          AND t."courseId" IS NOT NULL
          AND (${p}::timestamp IS NULL OR a."submittedAt" >= ${p}::timestamp)
      ) scored
    `;
    const counts = [row?.b0 ?? 0, row?.b1 ?? 0, row?.b2 ?? 0, row?.b3 ?? 0, row?.b4 ?? 0];
    return {
      scoreDistribution: SCORE_BUCKETS.map((bucket, i) => ({ bucket, count: counts[i] })),
      total: row?.total ?? 0,
    };
  }

  /**
   * Per-segment rollup for the admin Reports table. Aggregated in Postgres — the
   * inputs (every lesson view on the platform) are far too large to join in Node.
   *
   * Every column counts EVENTS inside the window — new enrolments by enrolment date,
   * completions by the date the student viewed the course's final lesson, average
   * score by submission date. They are independent flows, not a funnel: a segment can
   * record a completion in a window where nobody new enrolled, so the UI labels these
   * "new students"/"new enrolments" rather than implying one is a subset of the other.
   *
   * Courses with no segment roll up into an "Unassigned" row (`isUnassigned`) so the
   * columns reconcile with the totals tiles, but only when that row has activity.
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
        -- Finishing inside the window requires a view inside the window, so for a
        -- ranged report only those students' full history has to be aggregated.
        -- "All time" genuinely needs every row and gets no such shortcut.
        WHERE ${p}::timestamp IS NULL
           OR v."studentId" IN (SELECT v2."studentId" FROM "LessonView" v2 WHERE v2."viewedAt" >= ${p}::timestamp)
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
      SELECT si.segment_id AS "segmentId",
             COALESCE(s.name, 'Unassigned') AS "name",
             (si.segment_id IS NULL) AS "isUnassigned",
             COALESCE(ea.students, 0) AS "students",
             COALESCE(ea.enrollments, 0) AS "enrollments",
             COALESCE(ca.completions, 0) AS "completions",
             sa.avg_score AS "avgScore"
      FROM seg_ids si
      LEFT JOIN "Segment" s ON s.id = si.segment_id
      LEFT JOIN enr_agg ea ON ea.segment_id IS NOT DISTINCT FROM si.segment_id
      LEFT JOIN comp_agg ca ON ca.segment_id IS NOT DISTINCT FROM si.segment_id
      LEFT JOIN score_agg sa ON sa.segment_id IS NOT DISTINCT FROM si.segment_id
      -- Real segments always list, even at zero. The Unassigned row is noise unless
      -- an orphaned course actually saw activity in the window.
      WHERE si.segment_id IS NOT NULL
         OR COALESCE(ea.enrollments, 0) > 0
         OR COALESCE(ca.completions, 0) > 0
         OR sa.avg_score IS NOT NULL
      ORDER BY "enrollments" DESC, "name" ASC
    `;
  }

  async getAdminReport(range: ReportRange = 'ALL') {
    const now = new Date();
    const from = this.rangeStart(range, now);
    const buckets = this.buildBuckets(range, from, now);
    // Only the span the chart draws is fetched. Under "all time" the range filter is
    // empty, so without this the trend would pull every enrolment ever recorded to
    // fill six monthly bars.
    const trendFrom = new Date(buckets[0].start);

    const [trendRows, enrollmentCount, histogram, batchCount, completedBatchCount, courseCount, segmentBreakdown] =
      await Promise.all([
        this.prisma.enrollment.findMany({
          where: { enrolledAt: { gte: trendFrom } },
          select: { enrolledAt: true },
        }),
        this.prisma.enrollment.count({ where: from ? { enrolledAt: { gte: from } } : {} }),
        this.getScoreHistogram(from),
        this.prisma.batch.count(),
        this.prisma.batch.count({ where: { status: { isCompletionTarget: true } } }),
        this.prisma.course.count(),
        this.getSegmentBreakdown(from),
      ]);

    const enrollmentTrend = this.countIntoBuckets(
      buckets,
      trendRows.map((e) => e.enrolledAt),
    );

    return {
      enrollmentTrend,
      trendLabel: TREND_LABEL[range],
      scoreDistribution: histogram.scoreDistribution,
      batchCompletion: {
        completed: completedBatchCount,
        total: batchCount,
        rate: batchCount ? completedBatchCount / batchCount : 0,
      },
      totals: {
        totalCourses: courseCount,
        totalBatches: batchCount,
        totalMockTestAttempts: histogram.total,
        totalEnrollments: enrollmentCount,
      },
      segmentBreakdown,
      range,
    };
  }

  async getFacultyReport(faculty: JwtPayload) {
    const courses = await this.prisma.course.findMany({
      where: { facultyId: faculty.sub },
      include: {
        enrollments: { include: { student: { select: { id: true, fullName: true, email: true } } } },
        mockTests: true,
      },
      orderBy: { title: 'asc' },
    });

    // Batches and attempts used to be fetched per course inside the loop below —
    // two sequential round-trips each, so a faculty with 40 courses paid 80. Both
    // are now single queries covering every course, grouped in memory.
    const segmentIds = [...new Set(courses.map((c) => c.segmentId).filter((id): id is string => !!id))];
    const subsegmentIds = [...new Set(courses.map((c) => c.subsegmentId).filter((id): id is string => !!id))];
    const testIds = courses.flatMap((c) => c.mockTests.map((t) => t.id));

    const [batches, attempts] = await Promise.all([
      segmentIds.length || subsegmentIds.length
        ? this.prisma.batch.findMany({
            where: {
              OR: [
                ...(segmentIds.length ? [{ segmentId: { in: segmentIds } }] : []),
                ...(subsegmentIds.length ? [{ subsegmentId: { in: subsegmentIds } }] : []),
              ],
            },
            include: { status: true, _count: { select: { enrollments: true } } },
          })
        : [],
      testIds.length
        ? this.prisma.testAttempt.findMany({
            where: { testId: { in: testIds }, status: 'SUBMITTED', score: { not: null }, maxScore: { gt: 0 } },
            select: { testId: true, studentId: true, score: true, maxScore: true },
          })
        : [],
    ]);

    const batchesBySegment = new Map<string, typeof batches>();
    const batchesBySubsegment = new Map<string, typeof batches>();
    for (const b of batches) {
      if (b.segmentId) batchesBySegment.set(b.segmentId, [...(batchesBySegment.get(b.segmentId) ?? []), b]);
      if (b.subsegmentId) batchesBySubsegment.set(b.subsegmentId, [...(batchesBySubsegment.get(b.subsegmentId) ?? []), b]);
    }
    const attemptsByTest = new Map<string, typeof attempts>();
    for (const a of attempts) {
      attemptsByTest.set(a.testId, [...(attemptsByTest.get(a.testId) ?? []), a]);
    }

    return courses.map((course) => {
      // A batch matching on both segment and subsegment must still be listed once.
      const courseBatches = [
        ...(course.segmentId ? (batchesBySegment.get(course.segmentId) ?? []) : []),
        ...(course.subsegmentId ? (batchesBySubsegment.get(course.subsegmentId) ?? []) : []),
      ].filter((b, i, all) => all.findIndex((x) => x.id === b.id) === i);

      const byStudent = new Map<string, { best: number; attempts: number }>();
      for (const t of course.mockTests) {
        for (const a of attemptsByTest.get(t.id) ?? []) {
          const pct = ((a.score ?? 0) / (a.maxScore || 1)) * 100;
          const existing = byStudent.get(a.studentId);
          if (!existing) byStudent.set(a.studentId, { best: pct, attempts: 1 });
          else byStudent.set(a.studentId, { best: Math.max(existing.best, pct), attempts: existing.attempts + 1 });
        }
      }

      return {
        courseId: course.id,
        title: course.title,
        enrollmentCount: course.enrollments.length,
        batches: courseBatches.map((b) => ({
          id: b.id,
          name: b.name,
          status: b.status.name,
          // Every student in the batch, not just this course's — batches are matched
          // by segment, so the same batch appears under every course in that segment.
          batchEnrolledCount: b._count.enrollments,
        })),
        mockTestCount: course.mockTests.length,
        students: course.enrollments.map((e) => ({
          id: e.student.id,
          fullName: e.student.fullName,
          email: e.student.email,
          enrolledAt: e.enrolledAt,
          bestScorePct: byStudent.get(e.student.id)?.best ?? null,
          attemptCount: byStudent.get(e.student.id)?.attempts ?? 0,
        })),
      };
    });
  }
}
