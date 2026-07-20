import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';

export type ReportRange = 'RANGE_30' | 'QUARTER' | 'YTD' | 'ALL';

const SCORE_BUCKETS = ['0-20', '21-40', '41-60', '61-80', '81-100'];

function bucketForPct(pct: number) {
  if (pct <= 20) return 0;
  if (pct <= 40) return 1;
  if (pct <= 60) return 2;
  if (pct <= 80) return 3;
  return 4;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Start of the reporting window, or null for "all time". */
  private rangeStart(range: ReportRange): Date | null {
    const now = new Date();
    if (range === 'RANGE_30') return new Date(now.getTime() - 30 * 86_400_000);
    if (range === 'QUARTER') return new Date(now.getTime() - 90 * 86_400_000);
    if (range === 'YTD') return new Date(now.getFullYear(), 0, 1);
    return null;
  }

  /**
   * Per-segment rollup for the admin Reports table: enrolments, distinct students,
   * completions (a student who has viewed every lesson in a course they're enrolled in)
   * and average mock score, all scoped to the selected range.
   */
  private async getSegmentBreakdown(from: Date | null) {
    const [segments, courses, enrollments, lessons, views, attempts] = await Promise.all([
      this.prisma.segment.findMany({ select: { id: true, name: true } }),
      this.prisma.course.findMany({ select: { id: true, segmentId: true } }),
      this.prisma.enrollment.findMany({
        where: from ? { enrolledAt: { gte: from } } : {},
        select: { studentId: true, courseId: true },
      }),
      this.prisma.lesson.findMany({ select: { id: true, chapter: { select: { courseId: true } } } }),
      this.prisma.lessonView.findMany({ select: { studentId: true, lessonId: true } }),
      this.prisma.testAttempt.findMany({
        where: {
          status: 'SUBMITTED',
          score: { not: null },
          maxScore: { not: null },
          test: { courseId: { not: null } },
          ...(from ? { submittedAt: { gte: from } } : {}),
        },
        select: { score: true, maxScore: true, test: { select: { courseId: true } } },
      }),
    ]);

    const segmentOfCourse = new Map(courses.map((c) => [c.id, c.segmentId]));
    const lessonsPerCourse = new Map<string, string[]>();
    const courseOfLesson = new Map<string, string>();
    for (const l of lessons) {
      const cid = l.chapter.courseId;
      if (!cid) continue;
      courseOfLesson.set(l.id, cid);
      lessonsPerCourse.set(cid, [...(lessonsPerCourse.get(cid) ?? []), l.id]);
    }
    // studentId|courseId -> how many of that course's lessons they've viewed
    const viewedPerStudentCourse = new Map<string, Set<string>>();
    for (const v of views) {
      const cid = courseOfLesson.get(v.lessonId);
      if (!cid) continue;
      const key = `${v.studentId}|${cid}`;
      const set = viewedPerStudentCourse.get(key) ?? new Set<string>();
      set.add(v.lessonId);
      viewedPerStudentCourse.set(key, set);
    }

    const rows = segments.map((seg) => {
      const segEnrollments = enrollments.filter((e) => segmentOfCourse.get(e.courseId) === seg.id);
      const students = new Set(segEnrollments.map((e) => e.studentId));
      const completions = segEnrollments.filter((e) => {
        const total = lessonsPerCourse.get(e.courseId)?.length ?? 0;
        if (total === 0) return false;
        return (viewedPerStudentCourse.get(`${e.studentId}|${e.courseId}`)?.size ?? 0) >= total;
      }).length;
      const segAttempts = attempts.filter((a) => a.test.courseId && segmentOfCourse.get(a.test.courseId) === seg.id);
      const avgScore = segAttempts.length
        ? Math.round(
            (segAttempts.reduce((s, a) => s + ((a.score ?? 0) / (a.maxScore || 1)) * 100, 0) / segAttempts.length) * 10,
          ) / 10
        : null;
      return {
        segmentId: seg.id,
        name: seg.name,
        students: students.size,
        enrollments: segEnrollments.length,
        completions,
        avgScore,
      };
    });
    return rows.sort((a, b) => b.enrollments - a.enrollments);
  }

  async getAdminReport(range: ReportRange = 'ALL') {
    const from = this.rangeStart(range);
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

    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(monthKey(d));
    }
    const trendMap = new Map(months.map((m) => [m, 0]));
    for (const e of enrollments) {
      const key = monthKey(e.enrolledAt);
      if (trendMap.has(key)) trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
    }
    const enrollmentTrend = months.map((m) => ({ period: m, count: trendMap.get(m) ?? 0 }));

    const distCounts = [0, 0, 0, 0, 0];
    for (const a of attempts) {
      const pct = ((a.score ?? 0) / (a.maxScore || 1)) * 100;
      distCounts[bucketForPct(pct)]++;
    }
    const scoreDistribution = SCORE_BUCKETS.map((bucket, i) => ({ bucket, count: distCounts[i] }));

    const completedBatches = batches.filter((b) => b.status.isCompletionTarget).length;

    return {
      enrollmentTrend,
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
