import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { AiService, extractFirstJsonValue } from '../ai/ai.service';
import { withUniqueNameCheck } from '../common/unique-violation';
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

const LESSON_CONTEXT_CHAR_LIMIT = 15000;

function isOwnerOrAdmin(user: JwtPayload, facultyId: string) {
  return user.role === 'ADMIN' || user.sub === facultyId;
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly ai: AiService,
  ) {}

  async listCourses(user: JwtPayload, filters?: { segmentId?: string; subsegmentId?: string }) {
    const categoryFilter = {
      ...(filters?.segmentId ? { segmentId: filters.segmentId } : {}),
      ...(filters?.subsegmentId ? { subsegmentId: filters.subsegmentId } : {}),
    };

    let courses;
    if (user.role === 'STUDENT') {
      courses = await this.prisma.course.findMany({
        where: { published: true, ...categoryFilter },
        orderBy: { createdAt: 'desc' },
      });
    } else if (user.role === 'ADMIN') {
      courses = await this.prisma.course.findMany({
        where: categoryFilter,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { enrollments: true } } },
      });
    } else {
      courses = await this.prisma.course.findMany({
        where: { OR: [{ published: true }, { facultyId: user.sub }], ...categoryFilter },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { enrollments: true } } },
      });
    }

    return Promise.all(
      courses.map(async (course) => ({
        ...course,
        thumbnailUrl: course.thumbnailUrl ? await this.uploads.presignDownload(course.thumbnailUrl) : null,
      })),
    );
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
        bannerUrl: chapter.bannerUrl ? await this.uploads.presignDownload(chapter.bannerUrl) : null,
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

    return {
      ...course,
      thumbnailUrl: course.thumbnailUrl ? await this.uploads.presignDownload(course.thumbnailUrl) : null,
      chapters,
    };
  }

  async createCourse(user: JwtPayload, dto: CreateCourseDto) {
    if (dto.segmentId) {
      await this.validateSegmentation(dto.segmentId, dto.subsegmentId);
    }
    return withUniqueNameCheck(
      () =>
        this.prisma.course.create({
          data: {
            title: dto.title,
            description: dto.description ?? '',
            thumbnailUrl: dto.thumbnailUrl,
            facultyId: user.sub,
            segmentId: dto.segmentId,
            subsegmentId: dto.subsegmentId,
          },
        }),
      'course',
    );
  }

  async updateCourse(id: string, user: JwtPayload, dto: UpdateCourseDto) {
    const course = await this.requireCourse(id);
    this.assertOwnership(user, course.facultyId);

    if (dto.segmentId === null) {
      // explicit clear: a course without a segment can't keep a subsegment either
      return withUniqueNameCheck(
        () => this.prisma.course.update({ where: { id }, data: { ...dto, segmentId: null, subsegmentId: null } }),
        'course',
      );
    }

    if (dto.segmentId !== undefined || dto.subsegmentId !== undefined) {
      const segmentId = dto.segmentId ?? course.segmentId;
      const subsegmentId = dto.subsegmentId !== undefined ? dto.subsegmentId : course.subsegmentId;
      if (segmentId) {
        await this.validateSegmentation(segmentId, subsegmentId ?? undefined);
      }
    }

    return withUniqueNameCheck(() => this.prisma.course.update({ where: { id }, data: dto }), 'course');
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
    return this.prisma.chapter.create({ data: { title: dto.title, order: dto.order ?? 0, bannerUrl: dto.bannerUrl, courseId } });
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
        flashcardsEnabled: dto.flashcardsEnabled ?? false,
        aiNotesEnabled: dto.aiNotesEnabled ?? false,
        askMeEnabled: dto.askMeEnabled ?? false,
        transcript: dto.transcript,
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

  async generateFlashcards(lessonId: string, user: JwtPayload, count = 8) {
    const lesson = await this.requireLessonWithCourse(lessonId);
    this.assertOwnership(user, lesson.chapter.course.facultyId);

    const content = await this.getLessonContext(lesson);

    const cards = await this.callAiForFlashcards(content, count);

    const existingMax = await this.prisma.flashcard.aggregate({
      where: { lessonId },
      _max: { order: true },
    });
    let order = (existingMax._max.order ?? -1) + 1;

    return this.prisma.flashcard.createManyAndReturn({
      data: cards.map((c) => ({ front: c.front, back: c.back, order: order++, lessonId })),
    });
  }

  /** Extracts the grounding text used by AI features (flashcards, notes, chat) for a lesson. */
  private async getLessonContext(lesson: { type: LessonType; contentUrl: string | null; transcript: string | null }): Promise<string> {
    if (lesson.type === LessonType.PDF) {
      if (!lesson.contentUrl) {
        throw new BadRequestException('This PDF lesson has no uploaded file');
      }
      const { PDFParse } = require('pdf-parse');
      const buffer = await this.uploads.getObjectBuffer(lesson.contentUrl);
      const parser = new PDFParse({ data: buffer });
      const { text } = await parser.getText();
      const content = text.trim().slice(0, LESSON_CONTEXT_CHAR_LIMIT);
      if (!content) {
        throw new BadRequestException('Could not extract any text from this PDF');
      }
      return content;
    }

    if (lesson.type === LessonType.VIDEO) {
      const content = (lesson.transcript ?? '').trim().slice(0, LESSON_CONTEXT_CHAR_LIMIT);
      if (!content) {
        throw new BadRequestException('This video lesson has no transcript yet');
      }
      return content;
    }

    throw new BadRequestException('AI features currently require a PDF lesson with an uploaded file, or a video lesson with a transcript');
  }

  /**
   * Calls the AI and extracts a balanced JSON value, retrying once if the model's first
   * response doesn't contain one (the free OpenRouter model occasionally returns a plain-text
   * refusal/chitchat reply instead of the requested JSON).
   */
  private async completeJsonText(prompt: string, open: '[' | '{', close: ']' | '}'): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.ai.complete(prompt);
      const jsonText = extractFirstJsonValue(raw, open, close);
      if (jsonText) return jsonText;
    }
    throw new BadRequestException('AI did not return a valid response after retrying');
  }

  private async callAiForFlashcards(content: string, count: number): Promise<{ front: string; back: string }[]> {
    const jsonText = await this.completeJsonText(
      `Generate exactly ${count} study flashcards from the following lesson content. Respond with ONLY a JSON array, no markdown, no commentary, in this exact shape: [{"front": "question", "back": "answer"}]. Keep each side concise.\n\nLesson content:\n${content}`,
      '[',
      ']',
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new BadRequestException('AI response was not valid JSON');
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException('AI response was not a list of flashcards');
    }

    return parsed
      .filter((c): c is { front: string; back: string } => !!c && typeof c.front === 'string' && typeof c.back === 'string')
      .slice(0, count);
  }

  async generateNotes(lessonId: string, user: JwtPayload) {
    const lesson = await this.requireLessonWithCourse(lessonId);
    this.assertOwnership(user, lesson.chapter.course.facultyId);

    if (!lesson.aiNotesEnabled) {
      throw new BadRequestException('AI Notes is not enabled for this lesson');
    }

    const content = await this.getLessonContext(lesson);
    const note = await this.callAiForNotes(content);

    return this.prisma.lessonNote.upsert({
      where: { lessonId },
      create: { lessonId, summary: note.summary, keyPoints: note.keyPoints },
      update: { summary: note.summary, keyPoints: note.keyPoints },
    });
  }

  async getNotes(lessonId: string, user: JwtPayload) {
    const lesson = await this.requireLessonWithCourse(lessonId);
    const canView = await this.canViewCourseContent(lesson.chapter.course, user);
    if (!canView) throw new ForbiddenException('You do not have access to this lesson');

    return this.prisma.lessonNote.findUnique({ where: { lessonId } });
  }

  /** Used by the chat module: verifies access and returns the lesson's grounding text. */
  async requireLessonContextForChat(lessonId: string, user: JwtPayload): Promise<string> {
    const lesson = await this.requireLessonWithCourse(lessonId);
    const canView = await this.canViewCourseContent(lesson.chapter.course, user);
    if (!canView) throw new ForbiddenException('You do not have access to this lesson');
    if (!lesson.askMeEnabled) {
      throw new BadRequestException('Ask Me is not enabled for this lesson');
    }
    return this.getLessonContext(lesson);
  }

  private async callAiForNotes(content: string): Promise<{ summary: string; keyPoints: string[] }> {
    const jsonText = await this.completeJsonText(
      `Write concise study notes for the following lesson content. Respond with ONLY a JSON object, no markdown, no commentary, in this exact shape: {"summary": "a short paragraph summarizing the lesson", "keyPoints": ["key point 1", "key point 2"]}.\n\nLesson content:\n${content}`,
      '{',
      '}',
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new BadRequestException('AI response was not valid JSON');
    }

    const obj = parsed as { summary?: unknown; keyPoints?: unknown };
    if (typeof obj.summary !== 'string' || !Array.isArray(obj.keyPoints)) {
      throw new BadRequestException('AI response was not in the expected notes shape');
    }

    return {
      summary: obj.summary,
      keyPoints: obj.keyPoints.filter((p): p is string => typeof p === 'string'),
    };
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
