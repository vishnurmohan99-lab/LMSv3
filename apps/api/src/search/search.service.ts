import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';

export interface SearchHit {
  type: 'course' | 'test' | 'mentor';
  id: string;
  title: string;
  subtitle: string | null;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Global student search across courses, mock tests and mentors — backs the header
   * search / ⌘K palette. Scoped the same way the rest of the student app is: only
   * published content, and courses limited to the student's segment/subsegment
   * (mirrors CoursesService.listCourses) so search can't surface content they can't open.
   */
  async search(user: JwtPayload, rawQuery: string, limit = 5): Promise<SearchHit[]> {
    const q = rawQuery.trim();
    if (q.length < 2) return [];
    const contains = { contains: q, mode: 'insensitive' as const };

    const me = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { segmentId: true, subsegmentId: true },
    });
    const segmentMatch = me?.subsegmentId
      ? { subsegmentId: me.subsegmentId }
      : me?.segmentId
        ? { segmentId: me.segmentId, subsegmentId: null }
        : {};

    const [courses, tests, mentors] = await Promise.all([
      this.prisma.course.findMany({
        where: { published: true, title: contains, ...segmentMatch },
        select: { id: true, title: true, faculty: { select: { fullName: true } } },
        take: limit,
      }),
      this.prisma.test.findMany({
        where: { published: true, title: contains },
        select: { id: true, title: true, durationMinutes: true },
        take: limit,
      }),
      this.prisma.user.findMany({
        where: { isMentor: true, fullName: contains },
        select: { id: true, fullName: true, mentorSpecialty: true },
        take: limit,
      }),
    ]);

    return [
      ...courses.map((c) => ({
        type: 'course' as const,
        id: c.id,
        title: c.title,
        subtitle: c.faculty?.fullName ? `Course · ${c.faculty.fullName}` : 'Course',
      })),
      ...tests.map((t) => ({
        type: 'test' as const,
        id: t.id,
        title: t.title,
        subtitle: t.durationMinutes ? `Mock test · ${t.durationMinutes} min` : 'Mock test',
      })),
      ...mentors.map((m) => ({
        type: 'mentor' as const,
        id: m.id,
        title: m.fullName,
        subtitle: m.mentorSpecialty ? `Mentor · ${m.mentorSpecialty}` : 'Mentor',
      })),
    ];
  }
}
