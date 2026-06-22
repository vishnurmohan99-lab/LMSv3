import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';

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

  async getAdminReport() {
    const [enrollments, attempts, batches, courseCount, batchCount] = await Promise.all([
      this.prisma.enrollment.findMany({ select: { enrolledAt: true } }),
      this.prisma.testAttempt.findMany({
        where: { status: 'SUBMITTED', score: { not: null }, maxScore: { not: null }, test: { courseId: { not: null } } },
        select: { score: true, maxScore: true },
      }),
      this.prisma.batch.findMany({ select: { status: { select: { isCompletionTarget: true } } } }),
      this.prisma.course.count(),
      this.prisma.batch.count(),
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
    };
  }

  async getFacultyReport(faculty: JwtPayload) {
    const courses = await this.prisma.course.findMany({
      where: { facultyId: faculty.sub },
      include: {
        enrollments: { include: { student: { select: { id: true, fullName: true, email: true } } } },
        batches: { include: { status: true, _count: { select: { enrollments: true } } } },
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
        batches: course.batches.map((b) => ({ id: b.id, name: b.name, status: b.status.name, enrolledCount: b._count.enrollments })),
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
