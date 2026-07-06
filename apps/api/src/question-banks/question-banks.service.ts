import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import { UpdateQuestionBankDto } from './dto/update-question-bank.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateComprehensionDto } from './dto/create-comprehension.dto';
import { sanitizePrompt } from './sanitize-prompt';
import { withUniqueNameCheck } from '../common/unique-violation';

function isOwnerOrAdmin(user: JwtPayload, facultyId: string) {
  return user.role === 'ADMIN' || user.sub === facultyId;
}

@Injectable()
export class QuestionBanksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  async listQuestionBanks(user: JwtPayload) {
    const banks =
      user.role === 'ADMIN'
        ? await this.prisma.questionBank.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { questions: true } } } })
        : await this.prisma.questionBank.findMany({
            where: { OR: [{ published: true }, { facultyId: user.sub }] },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { questions: true } } },
          });

    return Promise.all(
      banks.map(async (bank) => ({
        ...bank,
        bannerUrl: bank.bannerUrl ? await this.uploads.presignDownload(bank.bannerUrl) : null,
      })),
    );
  }

  async getQuestionBank(id: string, user: JwtPayload) {
    const bank = await this.prisma.questionBank.findUnique({
      where: { id },
      include: { questions: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], include: { passage: true, tags: true } } },
    });
    if (!bank) throw new NotFoundException('Question bank not found');
    if (!bank.published && !isOwnerOrAdmin(user, bank.facultyId)) {
      throw new ForbiddenException('You do not have access to this question bank');
    }
    return {
      ...bank,
      bannerUrl: bank.bannerUrl ? await this.uploads.presignDownload(bank.bannerUrl) : null,
      questions: await Promise.all(bank.questions.map((q) => this.presignQuestionImages(q))),
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

  createQuestionBank(user: JwtPayload, dto: CreateQuestionBankDto) {
    return withUniqueNameCheck(
      () =>
        this.prisma.questionBank.create({
          data: {
            title: dto.title,
            description: dto.description ?? '',
            bannerUrl: dto.bannerUrl,
            facultyId: user.sub,
          },
        }),
      'question bank',
    );
  }

  async updateQuestionBank(id: string, user: JwtPayload, dto: UpdateQuestionBankDto) {
    const bank = await this.requireQuestionBank(id);
    this.assertOwnership(user, bank.facultyId);
    return withUniqueNameCheck(() => this.prisma.questionBank.update({ where: { id }, data: dto }), 'question bank');
  }

  async deleteQuestionBank(id: string, user: JwtPayload) {
    const bank = await this.requireQuestionBank(id);
    this.assertOwnership(user, bank.facultyId);
    await this.prisma.questionBank.delete({ where: { id } });
    return { success: true };
  }

  /** connectOrCreate input for a global tag list, so any new tag name becomes reusable. */
  private tagConnectOrCreate(names?: string[]) {
    const clean = Array.from(new Set((names ?? []).map((n) => n.trim()).filter(Boolean)));
    return clean.map((name) => ({ where: { name }, create: { name } }));
  }

  async createQuestion(bankId: string, user: JwtPayload, dto: CreateQuestionDto) {
    const bank = await this.requireQuestionBank(bankId);
    this.assertOwnership(user, bank.facultyId);
    const maxOrder = await this.prisma.question.aggregate({ where: { questionBankId: bankId }, _max: { order: true } });
    return this.prisma.question.create({
      data: {
        type: dto.type,
        prompt: sanitizePrompt(dto.prompt),
        order: dto.order ?? (maxOrder._max.order ?? -1) + 1,
        options: dto.options ?? [],
        correctOption: dto.correctOption,
        imageUrl: dto.imageUrl,
        difficulty: dto.difficulty,
        marks: dto.marks,
        negativeMarks: dto.negativeMarks,
        answerTimeSeconds: dto.answerTimeSeconds ?? null,
        tags: dto.tags?.length ? { connectOrCreate: this.tagConnectOrCreate(dto.tags) } : undefined,
        questionBankId: bankId,
      },
      include: { tags: true },
    });
  }

  /** Creates one Passage plus a batch of questions (MCQ/FILL_BLANK/TRUE_FALSE) that all reference it — a "Comprehension" set. */
  async createComprehension(bankId: string, user: JwtPayload, dto: CreateComprehensionDto) {
    const bank = await this.requireQuestionBank(bankId);
    this.assertOwnership(user, bank.facultyId);
    const existingMax = await this.prisma.question.aggregate({ where: { questionBankId: bankId }, _max: { order: true } });
    let order = (existingMax._max.order ?? -1) + 1;

    return this.prisma.passage.create({
      data: {
        text: dto.passageText.trim(),
        imageUrl: dto.passageImageUrl,
        questions: {
          create: dto.questions.map((q) => ({
            type: q.type ?? 'MCQ',
            prompt: sanitizePrompt(q.prompt),
            options: q.options ?? [],
            correctOption: q.correctOption,
            imageUrl: q.imageUrl,
            order: order++,
            questionBankId: bankId,
          })),
        },
      },
      include: { questions: true },
    });
  }

  async updateQuestion(id: string, user: JwtPayload, dto: UpdateQuestionDto) {
    const question = await this.requireQuestionWithBank(id);
    this.assertOwnership(user, question.questionBank.facultyId);
    const { tags, prompt, ...rest } = dto;
    return this.prisma.question.update({
      where: { id },
      data: {
        ...rest,
        prompt: prompt !== undefined ? sanitizePrompt(prompt) : undefined,
        // Replace the tag set entirely when tags are provided (clear then re-link).
        tags: tags !== undefined ? { set: [], connectOrCreate: this.tagConnectOrCreate(tags) } : undefined,
      },
      include: { tags: true },
    });
  }

  async deleteQuestion(id: string, user: JwtPayload) {
    const question = await this.requireQuestionWithBank(id);
    this.assertOwnership(user, question.questionBank.facultyId);
    await this.prisma.question.delete({ where: { id } });
    return { success: true };
  }

  private assertOwnership(user: JwtPayload, facultyId: string) {
    if (!isOwnerOrAdmin(user, facultyId)) {
      throw new ForbiddenException('You do not own this question bank');
    }
  }

  private async requireQuestionBank(id: string) {
    const bank = await this.prisma.questionBank.findUnique({ where: { id } });
    if (!bank) throw new NotFoundException('Question bank not found');
    return bank;
  }

  private async requireQuestionWithBank(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { questionBank: true },
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }
}
