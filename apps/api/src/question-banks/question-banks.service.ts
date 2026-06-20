import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import { UpdateQuestionBankDto } from './dto/update-question-bank.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { sanitizePrompt } from './sanitize-prompt';

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
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!bank) throw new NotFoundException('Question bank not found');
    if (!bank.published && !isOwnerOrAdmin(user, bank.facultyId)) {
      throw new ForbiddenException('You do not have access to this question bank');
    }
    return {
      ...bank,
      bannerUrl: bank.bannerUrl ? await this.uploads.presignDownload(bank.bannerUrl) : null,
    };
  }

  createQuestionBank(user: JwtPayload, dto: CreateQuestionBankDto) {
    return this.prisma.questionBank.create({
      data: {
        title: dto.title,
        description: dto.description ?? '',
        bannerUrl: dto.bannerUrl,
        facultyId: user.sub,
      },
    });
  }

  async updateQuestionBank(id: string, user: JwtPayload, dto: UpdateQuestionBankDto) {
    const bank = await this.requireQuestionBank(id);
    this.assertOwnership(user, bank.facultyId);
    return this.prisma.questionBank.update({ where: { id }, data: dto });
  }

  async deleteQuestionBank(id: string, user: JwtPayload) {
    const bank = await this.requireQuestionBank(id);
    this.assertOwnership(user, bank.facultyId);
    await this.prisma.questionBank.delete({ where: { id } });
    return { success: true };
  }

  async createQuestion(bankId: string, user: JwtPayload, dto: CreateQuestionDto) {
    const bank = await this.requireQuestionBank(bankId);
    this.assertOwnership(user, bank.facultyId);
    return this.prisma.question.create({
      data: {
        type: dto.type,
        prompt: sanitizePrompt(dto.prompt),
        order: dto.order ?? 0,
        options: dto.options ?? [],
        correctOption: dto.correctOption,
        questionBankId: bankId,
      },
    });
  }

  async updateQuestion(id: string, user: JwtPayload, dto: UpdateQuestionDto) {
    const question = await this.requireQuestionWithBank(id);
    this.assertOwnership(user, question.questionBank.facultyId);
    return this.prisma.question.update({
      where: { id },
      data: { ...dto, prompt: dto.prompt !== undefined ? sanitizePrompt(dto.prompt) : undefined },
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
