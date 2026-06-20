import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { LessonType } from '../../generated/prisma/client';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CreateFlashcardDto } from './dto/create-flashcard.dto';
import { UpdateFlashcardDto } from './dto/update-flashcard.dto';
import { FlashcardStatus } from '../../generated/prisma/client';

function isOwnerOrAdmin(user: JwtPayload, facultyId: string) {
  return user.role === 'ADMIN' || user.sub === facultyId;
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  async listCourses(user: JwtPayload, filters?: { segmentId?: string; subsegmentId?: string }) {
    const categoryFilter = {
      ...(filters?.segmentId ? { segmentId: filters.segmentId } : {}),
      ...(filters?.subsegmentId ? { subsegmentId: filters.subsegmentId } : {}),
    };

    if (user.role === 'STUDENT') {
      return this.prisma.course.findMany({
        where: { published: true, ...categoryFilter },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (user.role === 'ADMIN') {
      return this.prisma.course.findMany({
        where: categoryFilter,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { enrollments: true } } },
      });
    }
    return this.prisma.course.findMany({
      where: { OR: [{ published: true }, { facultyId: user.sub }], ...categoryFilter },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { enrollments: true } } },
    });
  }

  async enroll(courseId: string, user: JwtPayload) {
    const course = await this.requireCourse(courseId);
    if (!course.published) {
      throw new ForbiddenException('This course is not open for enrollment');
    }
    return this.prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId: user.sub, courseId } },
      create: { studentId: user.sub, courseId },
      update: {},
    });
  }

  listMyEnrollments(user: JwtPayload) {
    return this.prisma.enrollment.findMany({
      where: { studentId: user.sub },
      include: { course: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  async getCourseTree(id: string, user: JwtPayload) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { chapters: { orderBy: { order: 'asc' }, include: { lessons: { orderBy: { order: 'asc' } } } } },
    });
    if (!course) throw new NotFoundException('Course not found');

    const canView = await this.canViewCourseContent(course, user);
    if (!canView) throw new ForbiddenException('You do not have access to this course');

    const chapters = await Promise.all(
      course.chapters.map(async (chapter) => ({
        ...chapter,
        lessons: await Promise.all(
          chapter.lessons.map(async (lesson) => ({
            ...lesson,
            contentUrl:
              lesson.contentUrl && (lesson.type === LessonType.VIDEO || lesson.type === LessonType.PDF)
                ? await this.uploads.presignDownload(lesson.contentUrl)
                : lesson.contentUrl,
          })),
        ),
      })),
    );

    return { ...course, chapters };
  }

  async createCourse(user: JwtPayload, dto: CreateCourseDto) {
    await this.validateSegmentation(dto.segmentId, dto.subsegmentId);
    return this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        facultyId: user.sub,
        segmentId: dto.segmentId,
        subsegmentId: dto.subsegmentId,
      },
    });
  }

  async updateCourse(id: string, user: JwtPayload, dto: UpdateCourseDto) {
    const course = await this.requireCourse(id);
    this.assertOwnership(user, course.facultyId);

    if (dto.segmentId !== undefined || dto.subsegmentId !== undefined) {
      const segmentId = dto.segmentId ?? course.segmentId;
      const subsegmentId = dto.subsegmentId !== undefined ? dto.subsegmentId : course.subsegmentId;
      if (!segmentId) {
        throw new BadRequestException('A course must belong to a segment');
      }
      await this.validateSegmentation(segmentId, subsegmentId ?? undefined);
    }

    return this.prisma.course.update({ where: { id }, data: dto });
  }

  async deleteCourse(id: string, user: JwtPayload) {
    const course = await this.requireCourse(id);
    this.assertOwnership(user, course.facultyId);
    await this.prisma.course.delete({ where: { id } });
    return { success: true };
  }

  async createChapter(courseId: string, user: JwtPayload, dto: CreateChapterDto) {
    const course = await this.requireCourse(courseId);
    this.assertOwnership(user, course.facultyId);
    return this.prisma.chapter.create({ data: { title: dto.title, order: dto.order ?? 0, courseId } });
  }

  async updateChapter(id: string, user: JwtPayload, dto: UpdateChapterDto) {
    const chapter = await this.requireChapterWithCourse(id);
    this.assertOwnership(user, chapter.course.facultyId);
    return this.prisma.chapter.update({ where: { id }, data: dto });
  }

  async deleteChapter(id: string, user: JwtPayload) {
    const chapter = await this.requireChapterWithCourse(id);
    this.assertOwnership(user, chapter.course.facultyId);
    await this.prisma.chapter.delete({ where: { id } });
    return { success: true };
  }

  async createLesson(chapterId: string, user: JwtPayload, dto: CreateLessonDto) {
    const chapter = await this.requireChapterWithCourse(chapterId);
    this.assertOwnership(user, chapter.course.facultyId);
    return this.prisma.lesson.create({
      data: {
        title: dto.title,
        type: dto.type,
        order: dto.order ?? 0,
        contentUrl: dto.contentUrl,
        liveAt: dto.liveAt ? new Date(dto.liveAt) : undefined,
        chapterId,
      },
    });
  }

  async updateLesson(id: string, user: JwtPayload, dto: UpdateLessonDto) {
    const lesson = await this.requireLessonWithCourse(id);
    this.assertOwnership(user, lesson.chapter.course.facultyId);
    return this.prisma.lesson.update({
      where: { id },
      data: { ...dto, liveAt: dto.liveAt ? new Date(dto.liveAt) : undefined },
    });
  }

  async deleteLesson(id: string, user: JwtPayload) {
    const lesson = await this.requireLessonWithCourse(id);
    this.assertOwnership(user, lesson.chapter.course.facultyId);
    await this.prisma.lesson.delete({ where: { id } });
    return { success: true };
  }

  async createFlashcard(lessonId: string, user: JwtPayload, dto: CreateFlashcardDto) {
    const lesson = await this.requireLessonWithCourse(lessonId);
    this.assertOwnership(user, lesson.chapter.course.facultyId);
    return this.prisma.flashcard.create({
      data: { front: dto.front, back: dto.back, order: dto.order ?? 0, lessonId },
    });
  }

  async updateFlashcard(id: string, user: JwtPayload, dto: UpdateFlashcardDto) {
    const flashcard = await this.requireFlashcardWithCourse(id);
    this.assertOwnership(user, flashcard.lesson.chapter.course.facultyId);
    return this.prisma.flashcard.update({ where: { id }, data: dto });
  }

  async deleteFlashcard(id: string, user: JwtPayload) {
    const flashcard = await this.requireFlashcardWithCourse(id);
    this.assertOwnership(user, flashcard.lesson.chapter.course.facultyId);
    await this.prisma.flashcard.delete({ where: { id } });
    return { success: true };
  }

  async listFlashcards(lessonId: string, user: JwtPayload) {
    const lesson = await this.requireLessonWithCourse(lessonId);
    const canView = await this.canViewCourseContent(lesson.chapter.course, user);
    if (!canView) throw new ForbiddenException('You do not have access to this lesson');

    const flashcards = await this.prisma.flashcard.findMany({
      where: { lessonId },
      orderBy: { order: 'asc' },
      include:
        user.role === 'STUDENT'
          ? { progress: { where: { studentId: user.sub } } }
          : undefined,
    });

    if (user.role !== 'STUDENT') return flashcards;

    return flashcards.map((f) => {
      const { progress, ...rest } = f as typeof f & { progress: { status: FlashcardStatus }[] };
      return { ...rest, status: progress[0]?.status ?? FlashcardStatus.NEW };
    });
  }

  async setFlashcardProgress(flashcardId: string, user: JwtPayload, status: FlashcardStatus) {
    const flashcard = await this.requireFlashcardWithCourse(flashcardId);
    const canView = await this.canViewCourseContent(flashcard.lesson.chapter.course, user);
    if (!canView) throw new ForbiddenException('You do not have access to this lesson');

    return this.prisma.flashcardProgress.upsert({
      where: { studentId_flashcardId: { studentId: user.sub, flashcardId } },
      create: { studentId: user.sub, flashcardId, status, lastReviewedAt: new Date() },
      update: { status, lastReviewedAt: new Date() },
    });
  }

  private async requireFlashcardWithCourse(id: string) {
    const flashcard = await this.prisma.flashcard.findUnique({
      where: { id },
      include: { lesson: { include: { chapter: { include: { course: true } } } } },
    });
    if (!flashcard) throw new NotFoundException('Flashcard not found');
    return flashcard;
  }

  private async validateSegmentation(segmentId: string, subsegmentId?: string) {
    const segment = await this.prisma.segment.findUnique({ where: { id: segmentId } });
    if (!segment) throw new BadRequestException('Segment not found');

    if (subsegmentId) {
      const subsegment = await this.prisma.subsegment.findUnique({ where: { id: subsegmentId } });
      if (!subsegment) throw new BadRequestException('Subsegment not found');
      if (subsegment.segmentId !== segmentId) {
        throw new BadRequestException('Subsegment does not belong to the selected segment');
      }
    }
  }

  private async canViewCourseContent(course: { id: string; published: boolean; facultyId: string }, user: JwtPayload) {
    if (isOwnerOrAdmin(user, course.facultyId)) return true;
    if (!course.published) return false;
    if (user.role !== 'STUDENT') return true;
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: user.sub, courseId: course.id } },
    });
    return !!enrollment;
  }

  private assertOwnership(user: JwtPayload, facultyId: string) {
    if (!isOwnerOrAdmin(user, facultyId)) {
      throw new ForbiddenException('You do not own this course');
    }
  }

  private async requireCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  private async requireChapterWithCourse(id: string) {
    const chapter = await this.prisma.chapter.findUnique({ where: { id }, include: { course: true } });
    if (!chapter) throw new NotFoundException('Chapter not found');
    return chapter;
  }

  private async requireLessonWithCourse(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: { chapter: { include: { course: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }
}
