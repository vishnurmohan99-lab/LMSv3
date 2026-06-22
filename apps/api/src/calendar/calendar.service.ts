import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesService } from '../courses/courses.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';

export interface CalendarEvent {
  id: string;
  type: 'LIVE_LESSON' | 'MENTOR_SESSION';
  title: string;
  date: string;
  courseId?: string;
  courseTitle?: string;
  lessonId?: string;
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

    return [...liveEvents, ...mentorEvents].sort((a, b) => a.date.localeCompare(b.date));
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

    return [...liveEvents, ...mentorEvents].sort((a, b) => a.date.localeCompare(b.date));
  }
}
