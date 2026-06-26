import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { CreateTestQuestionDto } from './dto/create-test-question.dto';
import { UpdateTestQuestionDto } from './dto/update-test-question.dto';
import { ImportQuestionsDto } from './dto/import-questions.dto';
import { CreateComprehensionDto } from './dto/create-comprehension.dto';
import { sanitizePrompt } from '../question-banks/sanitize-prompt';
import { withUniqueNameCheck } from '../common/unique-violation';

function isOwnerOrAdmin(user: JwtPayload, facultyId: string) {
  return user.role === 'ADMIN' || user.sub === facultyId;
}

@Injectable()
export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  async listTests(user: JwtPayload, courseId?: string) {
    const courseFilter = courseId ? { courseId } : {};
    // Tests created inside a chapter are exercises local to that chapter — they never
    // appear in the standalone Tests tab/listing, only on the chapter itself.
    const chapterFilter = { chapterId: null };

    if (user.role === 'STUDENT' && !courseId) {
      const me = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { segmentId: true, subsegmentId: true } });
      const segmentMatch = me?.subsegmentId
        ? { subsegmentId: me.subsegmentId }
        : me?.segmentId
          ? { segmentId: me.segmentId, subsegmentId: null }
          : {};
      const tests = await this.prisma.test.findMany({
        where: { AND: [chapterFilter, { courseId: null }, segmentMatch, { published: true }] },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { testQuestions: true } } },
      });
      return this.presignTests(tests);
    }

    const tests =
      user.role === 'ADMIN'
        ? await this.prisma.test.findMany({
            where: { AND: [courseFilter, chapterFilter] },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { testQuestions: true } } },
          })
        : await this.prisma.test.findMany({
            where: { AND: [courseFilter, chapterFilter, { OR: [{ published: true }, { facultyId: user.sub }] }] },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { testQuestions: true } } },
          });

    return this.presignTests(tests);
  }

  private async presignTests<T extends { bannerUrl: string | null }>(tests: T[]): Promise<T[]> {
    return Promise.all(
      tests.map(async (test) => ({
        ...test,
        bannerUrl: test.bannerUrl ? await this.uploads.presignDownload(test.bannerUrl) : null,
      })),
    );
  }

  async getTest(id: string, user: JwtPayload) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: { testQuestions: { orderBy: { order: 'asc' }, include: { passage: true } } },
    });
    if (!test) throw new NotFoundException('Test not found');
    if (!test.published && !isOwnerOrAdmin(user, test.facultyId)) {
      throw new ForbiddenException('You do not have access to this test');
    }
    const owner = isOwnerOrAdmin(user, test.facultyId);
    const presigned = await Promise.all(test.testQuestions.map((q) => this.presignQuestionImages(q)));
    return {
      ...test,
      bannerUrl: test.bannerUrl ? await this.uploads.presignDownload(test.bannerUrl) : null,
      testQuestions: owner ? presigned : presigned.map((q) => ({ ...q, correctOption: null })),
    };
  }

  private async presignQuestionImages<T extends { imageUrl: string | null; passage: { imageUrl: string | null } | null }>(q: T): Promise<T> {
    return {
      ...q,
      imageUrl: q.imageUrl ? await this.uploads.presignDownload(q.imageUrl) : null,
      passage: q.passage
        ? { ...q.passage, imageUrl: q.passage.imageUrl ? await this.uploads.presignDownload(q.passage.imageUrl) : null }
        : null,
    };
  }

  async createTest(user: JwtPayload, dto: CreateTestDto) {
    if (dto.chapterId) {
      await this.requireChapter(dto.chapterId);
    }
    if (dto.courseId) {
      const course = await this.requireCourse(dto.courseId);
      this.assertOwnership(user, course.facultyId);
    }
    if (dto.segmentId) {
      await this.validateSegmentation(dto.segmentId, dto.subsegmentId);
    }
    return withUniqueNameCheck(
      () =>
        this.prisma.test.create({
          data: {
            title: dto.title,
            description: dto.description ?? '',
            bannerUrl: dto.bannerUrl,
            order: dto.order ?? 0,
            type: dto.type,
            chapterId: dto.chapterId,
            courseId: dto.courseId,
            segmentId: dto.segmentId,
            subsegmentId: dto.subsegmentId,
            facultyId: user.sub,
          },
        }),
      'test',
    );
  }

  async updateTest(id: string, user: JwtPayload, dto: UpdateTestDto) {
    const test = await this.requireTest(id);
    this.assertOwnership(user, test.facultyId);
    if (dto.chapterId) {
      await this.requireChapter(dto.chapterId);
    }
    if (dto.courseId) {
      const course = await this.requireCourse(dto.courseId);
      this.assertOwnership(user, course.facultyId);
    }

    if (dto.segmentId === null) {
      // explicit clear: a test without a segment can't keep a subsegment either
      return withUniqueNameCheck(
        () => this.prisma.test.update({ where: { id }, data: { ...dto, segmentId: null, subsegmentId: null } }),
        'test',
      );
    }
    if (dto.segmentId !== undefined || dto.subsegmentId !== undefined) {
      const segmentId = dto.segmentId ?? test.segmentId;
      const subsegmentId = dto.subsegmentId !== undefined ? dto.subsegmentId : test.subsegmentId;
      if (segmentId) {
        await this.validateSegmentation(segmentId, subsegmentId ?? undefined);
      }
    }

    return withUniqueNameCheck(
      () =>
        this.prisma.test.update({
          where: { id },
          data: {
            ...dto,
            availableFrom: dto.availableFrom !== undefined ? (dto.availableFrom ? new Date(dto.availableFrom) : null) : undefined,
            availableUntil: dto.availableUntil !== undefined ? (dto.availableUntil ? new Date(dto.availableUntil) : null) : undefined,
          },
        }),
      'test',
    );
  }

  private async validateSegmentation(segmentId: string, subsegmentId?: string | null) {
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

  async deleteTest(id: string, user: JwtPayload) {
    const test = await this.requireTest(id);
    this.assertOwnership(user, test.facultyId);
    await this.prisma.test.delete({ where: { id } });
    return { success: true };
  }

  async createQuestion(testId: string, user: JwtPayload, dto: CreateTestQuestionDto) {
    const test = await this.requireTest(testId);
    this.assertOwnership(user, test.facultyId);
    if (test.courseId && dto.type === 'ESSAY') {
      throw new BadRequestException('Mock tests only support auto-gradable question types (MCQ, TRUE_FALSE, FILL_BLANK)');
    }
    const maxOrder = await this.prisma.testQuestion.aggregate({ where: { testId }, _max: { order: true } });
    return this.prisma.testQuestion.create({
      data: {
        type: dto.type,
        prompt: sanitizePrompt(dto.prompt),
        order: dto.order ?? (maxOrder._max.order ?? -1) + 1,
        options: dto.options ?? [],
        correctOption: dto.correctOption,
        imageUrl: dto.imageUrl,
        testId,
      },
    });
  }

  /** Creates one Passage plus a batch of test questions (MCQ/FILL_BLANK/TRUE_FALSE) that all reference it — a "Comprehension" set. */
  async createComprehension(testId: string, user: JwtPayload, dto: CreateComprehensionDto) {
    const test = await this.requireTest(testId);
    this.assertOwnership(user, test.facultyId);
    const maxOrder = await this.prisma.testQuestion.aggregate({ where: { testId }, _max: { order: true } });
    let order = (maxOrder._max.order ?? -1) + 1;

    return this.prisma.passage.create({
      data: {
        text: dto.passageText.trim(),
        imageUrl: dto.passageImageUrl,
        testQuestions: {
          create: dto.questions.map((q) => ({
            type: q.type ?? 'MCQ',
            prompt: sanitizePrompt(q.prompt),
            options: q.options ?? [],
            correctOption: q.correctOption,
            imageUrl: q.imageUrl,
            order: order++,
            testId,
          })),
        },
      },
      include: { testQuestions: true },
    });
  }

  async updateQuestion(id: string, user: JwtPayload, dto: UpdateTestQuestionDto) {
    const question = await this.requireTestQuestion(id);
    this.assertOwnership(user, question.test.facultyId);
    return this.prisma.testQuestion.update({
      where: { id },
      data: { ...dto, prompt: dto.prompt !== undefined ? sanitizePrompt(dto.prompt) : undefined },
    });
  }

  async deleteQuestion(id: string, user: JwtPayload) {
    const question = await this.requireTestQuestion(id);
    this.assertOwnership(user, question.test.facultyId);
    await this.prisma.testQuestion.delete({ where: { id } });
    return { success: true };
  }

  async importQuestions(testId: string, user: JwtPayload, dto: ImportQuestionsDto) {
    const test = await this.requireTest(testId);
    this.assertOwnership(user, test.facultyId);

    const bank = await this.prisma.questionBank.findUnique({ where: { id: dto.questionBankId } });
    if (!bank) throw new NotFoundException('Question bank not found');

    const questions = await this.prisma.question.findMany({
      where: {
        questionBankId: dto.questionBankId,
        ...(dto.questionIds && dto.questionIds.length > 0 ? { id: { in: dto.questionIds } } : {}),
        ...(test.courseId ? { type: { not: 'ESSAY' } } : {}),
      },
      orderBy: { order: 'asc' },
    });
    if (questions.length === 0) throw new BadRequestException('No questions found to import');

    const maxOrder = await this.prisma.testQuestion.aggregate({ where: { testId }, _max: { order: true } });
    let order = (maxOrder._max.order ?? -1) + 1;

    return this.prisma.testQuestion.createManyAndReturn({
      data: questions.map((q) => ({
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        correctOption: q.correctOption,
        imageUrl: q.imageUrl,
        passageId: q.passageId,
        order: order++,
        testId,
      })),
    });
  }

  private assertOwnership(user: JwtPayload, facultyId: string) {
    if (!isOwnerOrAdmin(user, facultyId)) {
      throw new ForbiddenException('You do not own this test');
    }
  }

  private async requireTest(id: string) {
    const test = await this.prisma.test.findUnique({ where: { id } });
    if (!test) throw new NotFoundException('Test not found');
    return test;
  }

  private async requireTestQuestion(id: string) {
    const question = await this.prisma.testQuestion.findUnique({ where: { id }, include: { test: true } });
    if (!question) throw new NotFoundException('Test question not found');
    return question;
  }

  private async requireChapter(id: string) {
    const chapter = await this.prisma.chapter.findUnique({ where: { id } });
    if (!chapter) throw new NotFoundException('Chapter not found');
    return chapter;
  }

  private async requireCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }
}
