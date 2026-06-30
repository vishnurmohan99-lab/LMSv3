import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { AiService, extractFirstJsonValue } from '../ai/ai.service';
import { withUniqueNameCheck } from '../common/unique-violation';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { LessonType, AiFeature } from '../../generated/prisma/client';
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

export interface CheatSheetPage {
  title: string;
  bullets: string[];
  table?: { headers: string[]; rows: string[][] };
  examTip?: string;
  illustrationKey?: string;
}

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
      const me = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { segmentId: true, subsegmentId: true } });
      // A course tagged with a subsegment only matches students in that exact subsegment — matching by
      // parent segmentId alone would also surface every sibling subsegment's courses (they share segmentId).
      const segmentMatch = me?.subsegmentId
        ? { subsegmentId: me.subsegmentId }
        : me?.segmentId
          ? { segmentId: me.segmentId, subsegmentId: null }
          : {};
      courses = await this.prisma.course.findMany({
        where: {
          published: true,
          ...categoryFilter,
          OR: [
            { type: { in: ['FREE', 'PAID'] }, ...segmentMatch },
            { type: 'PRIVATE', privateAccess: { some: { studentId: user.sub } } },
            { enrollments: { some: { studentId: user.sub } } },
          ],
        },
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
    if (course.type === 'PAID') {
      throw new ForbiddenException('This course requires an active subscription — contact admin');
    }
    if (course.type === 'PRIVATE') {
      const access = await this.prisma.coursePrivateAccess.findUnique({
        where: { courseId_studentId: { courseId, studentId: user.sub } },
      });
      if (!access) throw new ForbiddenException('This course is private and you have not been granted access');
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
      include: {
        chapters: {
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
          include: {
            lessons: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
            tests: {
              select: { id: true, title: true, published: true, order: true, createdAt: true },
              orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const canView = await this.canViewCourseContent(course, user);
    if (!canView) throw new ForbiddenException('You do not have access to this course');

    const bypassDripping = isOwnerOrAdmin(user, course.facultyId);
    const enrolledAt = bypassDripping ? null : await this.getEnrollmentDate(course.id, user);
    const unlockMap = bypassDripping
      ? null
      : await this.getChapterUnlockMap(course, course.chapters, enrolledAt, user.sub);
    const finishedMap =
      !bypassDripping && course.dripType === 'SEQUENTIAL' ? await this.computeFinishedMap(course, course.chapters, user.sub) : null;

    const sequentialLessons = !bypassDripping && course.dripType === 'SEQUENTIAL';
    // Computed for every drip type (not just SEQUENTIAL, which only needs it for the lesson-chain
    // unlock check below) so the Planner's Weekly progress view has real per-chapter view data
    // for any course.
    const viewedLessonIds = new Set(
      (
        await this.prisma.lessonView.findMany({
          where: { studentId: user.sub, lessonId: { in: course.chapters.flatMap((c) => c.lessons.map((l) => l.id)) } },
          select: { lessonId: true },
        })
      ).map((v) => v.lessonId),
    );

    const chapters = await Promise.all(
      course.chapters.map(async (chapter) => {
        const { unlocked, unlocksAt } = bypassDripping ? { unlocked: true, unlocksAt: null as Date | null } : unlockMap!.get(chapter.id)!;
        const finished = finishedMap?.get(chapter.id) ?? false;

        // Within a SEQUENTIAL course, a lesson only unlocks once every earlier lesson in the same
        // chapter has been viewed — chained the same way chapter-to-chapter unlocking works above.
        let lessonChainUnlocked = unlocked;
        const lessons = await Promise.all(
          chapter.lessons.map(async (lesson) => {
            const lessonUnlocked = sequentialLessons ? lessonChainUnlocked : unlocked;
            if (sequentialLessons) lessonChainUnlocked = lessonChainUnlocked && viewedLessonIds.has(lesson.id);
            return {
              ...lesson,
              unlocked: lessonUnlocked,
              viewed: viewedLessonIds.has(lesson.id),
              contentUrl:
                lessonUnlocked && lesson.contentUrl && (lesson.type === LessonType.VIDEO || lesson.type === LessonType.PDF)
                  ? await this.uploads.presignDownload(lesson.contentUrl)
                  : null,
            };
          }),
        );
        // The chapter's own test(s) only unlock once all of its lessons are unlocked/viewed.
        const testsUnlocked = sequentialLessons ? lessonChainUnlocked : unlocked;

        return {
          ...chapter,
          unlocked,
          unlocksAt,
          finished,
          bannerUrl: chapter.bannerUrl ? await this.uploads.presignDownload(chapter.bannerUrl) : null,
          lessons,
          tests: chapter.tests.map((t) => ({ ...t, unlocked: testsUnlocked })),
        };
      }),
    );

    return {
      ...course,
      thumbnailUrl: course.thumbnailUrl ? await this.uploads.presignDownload(course.thumbnailUrl) : null,
      chapters,
    };
  }

  private async getEnrollmentDate(courseId: string, user: JwtPayload): Promise<Date | null> {
    if (user.role !== 'STUDENT') return null;
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: user.sub, courseId } },
      select: { enrolledAt: true },
    });
    return enrollment?.enrolledAt ?? null;
  }

  private resolveChapterUnlock(
    course: { dripType: string },
    chapter: { unlockAt: Date | null; unlockAfterDays: number | null },
    enrolledAt: Date | null,
  ): { unlocked: boolean; unlocksAt: Date | null } {
    if (course.dripType === 'CALENDAR') {
      if (!chapter.unlockAt) return { unlocked: true, unlocksAt: null };
      return { unlocked: new Date() >= chapter.unlockAt, unlocksAt: chapter.unlockAt };
    }
    if (course.dripType === 'ENROLLMENT_RELATIVE') {
      if (!chapter.unlockAfterDays || !enrolledAt) return { unlocked: true, unlocksAt: null };
      const unlocksAt = new Date(enrolledAt.getTime() + chapter.unlockAfterDays * 24 * 60 * 60 * 1000);
      return { unlocked: new Date() >= unlocksAt, unlocksAt };
    }
    return { unlocked: true, unlocksAt: null };
  }

  /**
   * Builds the per-chapter unlock state for a course. For CALENDAR/ENROLLMENT_RELATIVE/NONE this is just
   * resolveChapterUnlock per chapter. For SEQUENTIAL, chapter N is unlocked only if every earlier chapter
   * (by `order`) is "finished" per the course's completionRule — see computeFinishedMap.
   */
  private async getChapterUnlockMap(
    course: { dripType: string; completionRule: string },
    chapters: { id: string; order: number; unlockAt: Date | null; unlockAfterDays: number | null; lessons: { id: string }[]; tests: { id: string }[] }[],
    enrolledAt: Date | null,
    studentId: string,
  ): Promise<Map<string, { unlocked: boolean; unlocksAt: Date | null }>> {
    const map = new Map<string, { unlocked: boolean; unlocksAt: Date | null }>();

    if (course.dripType !== 'SEQUENTIAL') {
      for (const chapter of chapters) {
        map.set(chapter.id, this.resolveChapterUnlock(course, chapter, enrolledAt));
      }
      return map;
    }

    const ordered = [...chapters].sort((a, b) => a.order - b.order);
    const finishedMap = await this.computeFinishedMap(course, ordered, studentId);
    let chainUnlocked = true;
    for (const chapter of ordered) {
      map.set(chapter.id, { unlocked: chainUnlocked, unlocksAt: null });
      chainUnlocked = chainUnlocked && !!finishedMap.get(chapter.id);
    }
    return map;
  }

  /** Determines, per the course's completionRule, whether each chapter counts as "finished" for this student. */
  private async computeFinishedMap(
    course: { completionRule: string },
    chapters: { id: string; lessons: { id: string }[]; tests: { id: string }[] }[],
    studentId: string,
  ): Promise<Map<string, boolean>> {
    const finished = new Map<string, boolean>();

    if (course.completionRule === 'ALL_LESSONS_VIEWED') {
      const allLessonIds = chapters.flatMap((c) => c.lessons.map((l) => l.id));
      const views = allLessonIds.length
        ? await this.prisma.lessonView.findMany({ where: { studentId, lessonId: { in: allLessonIds } }, select: { lessonId: true } })
        : [];
      const viewed = new Set(views.map((v) => v.lessonId));
      for (const chapter of chapters) {
        finished.set(chapter.id, chapter.lessons.length > 0 && chapter.lessons.every((l) => viewed.has(l.id)));
      }
      return finished;
    }

    if (course.completionRule === 'PASS_TEST') {
      const allTestIds = chapters.flatMap((c) => c.tests.map((t) => t.id));
      const attempts = allTestIds.length
        ? await this.prisma.testAttempt.findMany({
            where: { studentId, testId: { in: allTestIds }, status: 'SUBMITTED' },
            select: { testId: true, score: true, maxScore: true },
          })
        : [];
      const passedTestIds = new Set(
        attempts.filter((a) => a.score != null && a.maxScore && a.score * 2 >= a.maxScore).map((a) => a.testId),
      );
      // Chapters with no test attached can't be gated by a test score — fall back to manual completion for those.
      const fallbackChapterIds = chapters.filter((c) => c.tests.length === 0).map((c) => c.id);
      const fallbackCompletions = fallbackChapterIds.length
        ? await this.prisma.chapterCompletion.findMany({ where: { studentId, chapterId: { in: fallbackChapterIds } }, select: { chapterId: true } })
        : [];
      const manuallyCompleted = new Set(fallbackCompletions.map((c) => c.chapterId));
      for (const chapter of chapters) {
        finished.set(
          chapter.id,
          chapter.tests.length > 0 ? chapter.tests.some((t) => passedTestIds.has(t.id)) : manuallyCompleted.has(chapter.id),
        );
      }
      return finished;
    }

    // MANUAL (default): student explicitly marks the chapter complete.
    const chapterIds = chapters.map((c) => c.id);
    const completions = chapterIds.length
      ? await this.prisma.chapterCompletion.findMany({ where: { studentId, chapterId: { in: chapterIds } }, select: { chapterId: true } })
      : [];
    const completedSet = new Set(completions.map((c) => c.chapterId));
    for (const chapter of chapters) finished.set(chapter.id, completedSet.has(chapter.id));
    return finished;
  }

  async isChapterUnlockedForUser(chapterId: string, user: JwtPayload): Promise<boolean> {
    const chapter = await this.prisma.chapter.findUnique({ where: { id: chapterId }, include: { course: true } });
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (isOwnerOrAdmin(user, chapter.course.facultyId)) return true;
    if (chapter.course.dripType !== 'SEQUENTIAL') {
      const enrolledAt = await this.getEnrollmentDate(chapter.course.id, user);
      return this.resolveChapterUnlock(chapter.course, chapter, enrolledAt).unlocked;
    }
    const siblings = await this.prisma.chapter.findMany({
      where: { courseId: chapter.course.id },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      include: { lessons: { select: { id: true } }, tests: { select: { id: true } } },
    });
    const unlockMap = await this.getChapterUnlockMap(chapter.course, siblings, null, user.sub);
    return !!unlockMap.get(chapterId)?.unlocked;
  }

  async markChapterComplete(chapterId: string, user: JwtPayload) {
    const chapter = await this.requireChapterWithCourse(chapterId);
    const canView = await this.canViewCourseContent(chapter.course, user);
    if (!canView) throw new ForbiddenException('You do not have access to this chapter');
    if (chapter.course.dripType !== 'SEQUENTIAL') {
      throw new BadRequestException('This course does not use sequential unlocking');
    }
    const unlocked = await this.isChapterUnlockedForUser(chapterId, user);
    if (!unlocked) throw new ForbiddenException('This chapter is not unlocked yet');
    return this.prisma.chapterCompletion.upsert({
      where: { chapterId_studentId: { chapterId, studentId: user.sub } },
      create: { chapterId, studentId: user.sub },
      update: {},
    });
  }

  async recordLessonView(lessonId: string, user: JwtPayload) {
    if (user.role !== 'STUDENT') return { success: true };
    const lesson = await this.requireLessonWithCourse(lessonId);
    const canView = await this.canViewCourseContent(lesson.chapter.course, user);
    if (!canView) return { success: true };

    if (lesson.chapter.course.dripType === 'SEQUENTIAL') {
      const chapterUnlocked = await this.isChapterUnlockedForUser(lesson.chapterId, user);
      if (!chapterUnlocked) throw new ForbiddenException('This chapter is not unlocked yet');
      const siblings = await this.prisma.lesson.findMany({
        where: { chapterId: lesson.chapterId },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      const idx = siblings.findIndex((l) => l.id === lessonId);
      if (idx > 0) {
        const priorIds = siblings.slice(0, idx).map((l) => l.id);
        const viewedCount = await this.prisma.lessonView.count({ where: { studentId: user.sub, lessonId: { in: priorIds } } });
        if (viewedCount < priorIds.length) throw new ForbiddenException('Complete the previous lesson first');
      }
    }

    await this.prisma.lessonView.upsert({
      where: { lessonId_studentId: { lessonId, studentId: user.sub } },
      create: { lessonId, studentId: user.sub },
      update: {},
    });
    return { success: true };
  }

  /**
   * Per-day lesson-view counts for the current student over the last ~17 weeks,
   * used by the dashboard study-activity heatmap. Buckets by UTC date so the
   * frontend can align cells without timezone drift. Returns only non-zero days.
   */
  async getMyActivity(user: JwtPayload) {
    const DAYS = 17 * 7;
    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCDate(cutoff.getUTCDate() - (DAYS - 1));
    const views = await this.prisma.lessonView.findMany({
      where: { studentId: user.sub, viewedAt: { gte: cutoff } },
      select: { viewedAt: true },
    });
    const counts = new Map<string, number>();
    for (const v of views) {
      const key = v.viewedAt.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts, ([date, count]) => ({ date, count }));
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
            type: dto.type,
            dripType: dto.dripType,
            completionRule: dto.completionRule,
            published: dto.published ?? false,
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

  async listPrivateAccess(courseId: string, user: JwtPayload) {
    const course = await this.requireCourse(courseId);
    this.assertOwnership(user, course.facultyId);
    return this.prisma.coursePrivateAccess.findMany({
      where: { courseId },
      include: { student: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async grantPrivateAccess(courseId: string, user: JwtPayload, studentId: string) {
    const course = await this.requireCourse(courseId);
    this.assertOwnership(user, course.facultyId);
    const access = await this.prisma.coursePrivateAccess.upsert({
      where: { courseId_studentId: { courseId, studentId } },
      create: { courseId, studentId },
      update: {},
    });
    await this.prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId, courseId } },
      create: { studentId, courseId, source: 'ADMIN' },
      update: {},
    });
    return access;
  }

  async revokePrivateAccess(courseId: string, user: JwtPayload, studentId: string) {
    const course = await this.requireCourse(courseId);
    this.assertOwnership(user, course.facultyId);
    await this.prisma.coursePrivateAccess.deleteMany({ where: { courseId, studentId } });
    return { success: true };
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
    return this.prisma.chapter.create({
      data: {
        title: dto.title,
        order: dto.order ?? 0,
        bannerUrl: dto.bannerUrl,
        unlockAt: dto.unlockAt ? new Date(dto.unlockAt) : undefined,
        unlockAfterDays: dto.unlockAfterDays,
        courseId,
      },
    });
  }

  async updateChapter(id: string, user: JwtPayload, dto: UpdateChapterDto) {
    const chapter = await this.requireChapterWithCourse(id);
    this.assertOwnership(user, chapter.course.facultyId);
    return this.prisma.chapter.update({
      where: { id },
      data: { ...dto, unlockAt: dto.unlockAt === undefined ? undefined : dto.unlockAt ? new Date(dto.unlockAt) : null },
    });
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
        summaryDeckEnabled: dto.summaryDeckEnabled ?? false,
        cheatSheetEnabled: dto.cheatSheetEnabled ?? false,
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
  private async completeJsonText(prompt: string, open: '[' | '{', close: ']' | '}', feature: AiFeature): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.ai.complete(prompt, feature);
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
      'FLASHCARDS',
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
    if (lesson.type !== LessonType.VIDEO) {
      throw new BadRequestException('AI Notes is only available for video lessons');
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
    if (!(await this.isChapterUnlockedForUser(lesson.chapterId, user))) {
      throw new ForbiddenException('This chapter is not unlocked yet');
    }

    return this.prisma.lessonNote.findUnique({ where: { lessonId } });
  }

  async generateSummaryDeck(lessonId: string, user: JwtPayload, count = 8) {
    const lesson = await this.requireLessonWithCourse(lessonId);
    this.assertOwnership(user, lesson.chapter.course.facultyId);

    if (!lesson.summaryDeckEnabled) {
      throw new BadRequestException('Summary Deck is not enabled for this lesson');
    }

    const content = await this.getLessonContext(lesson);
    const cards = await this.callAiForSummaryDeck(content, count);

    return this.prisma.summaryDeck.upsert({
      where: { lessonId },
      create: { lessonId, cards },
      update: { cards },
    });
  }

  async getSummaryDeck(lessonId: string, user: JwtPayload) {
    const lesson = await this.requireLessonWithCourse(lessonId);
    const canView = await this.canViewCourseContent(lesson.chapter.course, user);
    if (!canView) throw new ForbiddenException('You do not have access to this lesson');
    if (!(await this.isChapterUnlockedForUser(lesson.chapterId, user))) {
      throw new ForbiddenException('This chapter is not unlocked yet');
    }

    return this.prisma.summaryDeck.findUnique({ where: { lessonId } });
  }

  private async callAiForSummaryDeck(content: string, count: number): Promise<string[]> {
    const jsonText = await this.completeJsonText(
      `Split the following lesson content into exactly ${count} short summary cards that together cover the ENTIRE content from start to finish, in order. Each card should be 1-3 sentences, self-contained, and readable on its own. Respond with ONLY a JSON array of strings, no markdown, no commentary, in this exact shape: ["card 1 text", "card 2 text"].\n\nLesson content:\n${content}`,
      '[',
      ']',
      'SUMMARY_DECK',
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new BadRequestException('AI response was not valid JSON');
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException('AI response was not a list of summary cards');
    }

    return parsed.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).slice(0, count);
  }

  async generateCheatSheet(lessonId: string, user: JwtPayload) {
    const lesson = await this.requireLessonWithCourse(lessonId);
    this.assertOwnership(user, lesson.chapter.course.facultyId);

    if (!lesson.cheatSheetEnabled) {
      throw new BadRequestException('Cheat Sheet is not enabled for this lesson');
    }
    if (lesson.type !== LessonType.PDF) {
      throw new BadRequestException('Cheat Sheet is currently only available for PDF lessons');
    }

    const content = await this.getLessonContext(lesson);
    const pageCount = Math.max(3, Math.min(8, Math.ceil(content.length / 2000)));
    const draftPages = await this.callAiForCheatSheet(content, pageCount);

    const pages: CheatSheetPage[] = [];
    for (const draft of draftPages) {
      let illustrationKey: string | undefined;
      try {
        const { buffer, contentType } = await this.ai.generateImage(
          `Simple, clean, flat-style educational illustration (no text, no words, no letters in the image) representing: ${draft.title}. Minimal, portrait orientation, friendly study-material aesthetic.`,
          'CHEAT_SHEET_IMAGE',
        );
        illustrationKey = await this.uploads.uploadGeneratedImage(buffer, contentType);
      } catch (err) {
        // Illustration is a nice-to-have -- a failed/quota-limited image call must not fail the whole cheat sheet.
        console.error('[CheatSheet] illustration generation failed:', err instanceof Error ? err.message : err);
      }
      pages.push({ ...draft, illustrationKey });
    }

    return this.prisma.cheatSheet.upsert({
      where: { lessonId },
      create: { lessonId, pages: pages as object },
      update: { pages: pages as object },
    });
  }

  async getCheatSheet(lessonId: string, user: JwtPayload) {
    const lesson = await this.requireLessonWithCourse(lessonId);
    const canView = await this.canViewCourseContent(lesson.chapter.course, user);
    if (!canView) throw new ForbiddenException('You do not have access to this lesson');
    if (!(await this.isChapterUnlockedForUser(lesson.chapterId, user))) {
      throw new ForbiddenException('This chapter is not unlocked yet');
    }

    const sheet = await this.prisma.cheatSheet.findUnique({ where: { lessonId } });
    if (!sheet) return null;

    const pages = (sheet.pages as unknown as CheatSheetPage[]) ?? [];
    const presignedPages = await Promise.all(
      pages.map(async (p) => ({ ...p, illustrationUrl: p.illustrationKey ? await this.uploads.presignDownload(p.illustrationKey) : null })),
    );
    return { ...sheet, pages: presignedPages };
  }

  private async callAiForCheatSheet(content: string, count: number): Promise<CheatSheetPage[]> {
    const jsonText = await this.completeJsonText(
      `You are creating an exam-revision cheat sheet from the following lesson content. Split it into exactly ${count} portrait-oriented pages that together cover the ENTIRE content from start to finish, in order. Do NOT copy sentences verbatim -- rewrite everything into concise, easy-to-understand bullet points. Each page covers one coherent topic/sub-topic and should include a short, punchy "examTip" (a high-yield exam tip or key thing to remember). Include a "table" only when the content has genuinely tabular/comparison data (otherwise omit it). Respond with ONLY a JSON array, no markdown, no commentary, in this exact shape: [{"title": "Topic name", "bullets": ["concise rewritten point", "..."], "table": {"headers": ["Col A", "Col B"], "rows": [["a1", "b1"]]}, "examTip": "short high-yield tip"}]. Omit "table" entirely for pages with no tabular content.\n\nLesson content:\n${content}`,
      '[',
      ']',
      'CHEAT_SHEET_TEXT',
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new BadRequestException('AI response was not valid JSON');
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException('AI response was not a list of cheat sheet pages');
    }

    return parsed
      .filter((p): p is CheatSheetPage => !!p && typeof p.title === 'string' && Array.isArray(p.bullets))
      .slice(0, count)
      .map((p) => ({
        title: p.title,
        bullets: p.bullets.filter((b): b is string => typeof b === 'string'),
        table:
          p.table && Array.isArray(p.table.headers) && Array.isArray(p.table.rows)
            ? { headers: p.table.headers, rows: p.table.rows }
            : undefined,
        examTip: typeof p.examTip === 'string' ? p.examTip : undefined,
      }));
  }

  /** Used by the chat module: verifies access and returns the lesson's grounding text. */
  async requireLessonContextForChat(lessonId: string, user: JwtPayload): Promise<string> {
    const lesson = await this.requireLessonWithCourse(lessonId);
    const canView = await this.canViewCourseContent(lesson.chapter.course, user);
    if (!canView) throw new ForbiddenException('You do not have access to this lesson');
    if (!(await this.isChapterUnlockedForUser(lesson.chapterId, user))) {
      throw new ForbiddenException('This chapter is not unlocked yet');
    }
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
      'NOTES',
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
    if (!(await this.isChapterUnlockedForUser(lesson.chapterId, user))) {
      throw new ForbiddenException('This chapter is not unlocked yet');
    }

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
    if (!(await this.isChapterUnlockedForUser(flashcard.lesson.chapterId, user))) {
      throw new ForbiddenException('This chapter is not unlocked yet');
    }

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
