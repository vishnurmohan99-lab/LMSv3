import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';

export interface CalendarEvent {
  id: string;
  type: 'LIVE_LESSON' | 'MENTOR_SESSION' | 'CHAPTER_UNLOCK' | 'TEST';
  title: string;
  date: string;
  courseId?: string;
  courseTitle?: string;
  lessonId?: string;
  testId?: string;
  otherPartyName?: string;
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CoursesService,
  ) {}

  async getEventsForStudent(user: JwtPayload): Promise<CalendarEvent[]> {
    const lessons = await this.prisma.lesson.findMany({
      where: {
        type: 'LIVE',
        liveAt: { not: null },
        chapter: { course: { enrollments: { some: { studentId: user.sub } } } },
      },
      include: { chapter: { include: { course: true } } },
    });

    const unlockedLessons = await Promise.all(
      lessons.map(async (lesson) => ({
        lesson,
        unlocked: await this.courses.isChapterUnlockedForUser(lesson.chapterId, user),
      })),
    );

    const liveEvents: CalendarEvent[] = unlockedLessons
      .filter((l) => l.unlocked)
      .map(({ lesson }) => ({
        id: `lesson_${lesson.id}`,
        type: 'LIVE_LESSON' as const,
        title: lesson.title,
        date: lesson.liveAt!.toISOString(),
        courseId: lesson.chapter.course.id,
        courseTitle: lesson.chapter.course.title,
        lessonId: lesson.id,
      }));

    const bookings = await this.prisma.mentorBooking.findMany({
      where: { studentId: user.sub, cancelledAt: null },
      include: { mentor: { select: { fullName: true } }, availability: true },
    });

    const mentorEvents: CalendarEvent[] = bookings.map((b) => ({
      id: `booking_${b.id}`,
      type: 'MENTOR_SESSION' as const,
      title: `Mentor session with ${b.mentor.fullName}`,
      date: combineDateAndTime(b.date, b.availability.time).toISOString(),
      otherPartyName: b.mentor.fullName,
    }));

    const calendarChapters = await this.prisma.chapter.findMany({
      where: {
        unlockAt: { not: null },
        course: { dripType: 'CALENDAR', enrollments: { some: { studentId: user.sub } } },
      },
      include: { course: { select: { id: true, title: true } } },
    });

    const unlockEvents: CalendarEvent[] = calendarChapters.map((chapter) => ({
      id: `chapter_unlock_${chapter.id}`,
      type: 'CHAPTER_UNLOCK' as const,
      title: `${chapter.title} unlocks`,
      date: chapter.unlockAt!.toISOString(),
      courseId: chapter.course.id,
      courseTitle: chapter.course.title,
    }));

    const testEvents = await this.getTestEventsForStudent(user);

    return [...liveEvents, ...mentorEvents, ...unlockEvents, ...testEvents].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Scheduled (TIMED, dated) tests a student has access to — course-linked, chapter-linked, or standalone-by-segment. */
  private async getTestEventsForStudent(user: JwtPayload): Promise<CalendarEvent[]> {
    const baseFilter = { published: true, publishMode: 'TIMED' as const, availableFrom: { not: null } };

    const courseTests = await this.prisma.test.findMany({
      where: { ...baseFilter, courseId: { not: null }, course: { enrollments: { some: { studentId: user.sub } } } },
      include: { course: { select: { id: true, title: true } } },
    });

    const chapterTestsRaw = await this.prisma.test.findMany({
      where: { ...baseFilter, chapterId: { not: null }, chapter: { course: { enrollments: { some: { studentId: user.sub } } } } },
      include: { chapter: { include: { course: { select: { id: true, title: true } } } } },
    });
    const chapterTests = await Promise.all(
      chapterTestsRaw.map(async (t) => ({ t, unlocked: await this.courses.isChapterUnlockedForUser(t.chapterId!, user) })),
    );

    const me = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { segmentId: true, subsegmentId: true } });
    const segmentMatch = me?.subsegmentId
      ? { subsegmentId: me.subsegmentId }
      : me?.segmentId
        ? { segmentId: me.segmentId, subsegmentId: null }
        : {};
    const standaloneTests = await this.prisma.test.findMany({
      where: { ...baseFilter, courseId: null, chapterId: null, ...segmentMatch },
    });

    return [
      ...courseTests.map((t) => ({
        id: `test_${t.id}`,
        type: 'TEST' as const,
        title: t.title,
        date: t.availableFrom!.toISOString(),
        testId: t.id,
        courseId: t.course!.id,
        courseTitle: t.course!.title,
      })),
      ...chapterTests
        .filter((x) => x.unlocked)
        .map(({ t }) => ({
          id: `test_${t.id}`,
          type: 'TEST' as const,
          title: t.title,
          date: t.availableFrom!.toISOString(),
          testId: t.id,
          courseId: t.chapter!.course.id,
          courseTitle: t.chapter!.course.title,
        })),
      ...standaloneTests.map((t) => ({
        id: `test_${t.id}`,
        type: 'TEST' as const,
        title: t.title,
        date: t.availableFrom!.toISOString(),
        testId: t.id,
      })),
    ];
  }

  async getEventsForFaculty(user: JwtPayload): Promise<CalendarEvent[]> {
    const lessons = await this.prisma.lesson.findMany({
      where: {
        type: 'LIVE',
        liveAt: { not: null },
        chapter: { course: { facultyId: user.sub } },
      },
      include: { chapter: { include: { course: true } } },
    });

    const liveEvents: CalendarEvent[] = lessons.map((lesson) => ({
      id: `lesson_${lesson.id}`,
      type: 'LIVE_LESSON' as const,
      title: lesson.title,
      date: lesson.liveAt!.toISOString(),
      courseId: lesson.chapter.course.id,
      courseTitle: lesson.chapter.course.title,
      lessonId: lesson.id,
    }));

    const bookings = await this.prisma.mentorBooking.findMany({
      where: { mentorId: user.sub, cancelledAt: null },
      include: { student: { select: { fullName: true } }, availability: true },
    });

    const mentorEvents: CalendarEvent[] = bookings.map((b) => ({
      id: `booking_${b.id}`,
      type: 'MENTOR_SESSION' as const,
      title: `Mentor session with ${b.student.fullName}`,
      date: combineDateAndTime(b.date, b.availability.time).toISOString(),
      otherPartyName: b.student.fullName,
    }));

    const ownTests = await this.prisma.test.findMany({
      where: { facultyId: user.sub, publishMode: 'TIMED', availableFrom: { not: null } },
      include: { course: { select: { id: true, title: true } } },
    });
    const testEvents: CalendarEvent[] = ownTests.map((t) => ({
      id: `test_${t.id}`,
      type: 'TEST' as const,
      title: t.title,
      date: t.availableFrom!.toISOString(),
      testId: t.id,
      courseId: t.course?.id,
      courseTitle: t.course?.title,
    }));

    return [...liveEvents, ...mentorEvents, ...testEvents].sort((a, b) => a.date.localeCompare(b.date));
  }
}
