import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { withUniqueNameCheck } from '../common/unique-violation';
import { CreateAnswerQuestionTypeDto } from './dto/create-answer-question-type.dto';
import { UpdateAnswerQuestionTypeDto } from './dto/update-answer-question-type.dto';
import { CreateAnswerQuestionDto } from './dto/create-answer-question.dto';
import { UpdateAnswerQuestionDto } from './dto/update-answer-question.dto';

const RECONCILIATION_TOLERANCE = 0.01;

/**
 * Validates the part/point/group marks reconcile to the question's maxMarks. Pure function so
 * it can also be exercised directly by tests; throws BadRequestException on mismatch.
 */
export function validateRubricReconciliation(dto: { maxMarks: number; parts: CreateAnswerQuestionDto['parts'] }) {
  const partsSum = dto.parts.reduce((s, p) => s + p.marks, 0);
  if (Math.abs(partsSum - dto.maxMarks) > RECONCILIATION_TOLERANCE) {
    throw new BadRequestException(`Part marks (${partsSum}) must sum to max marks (${dto.maxMarks})`);
  }
  for (const part of dto.parts) {
    const mustIncludeSum = part.mustInclude.reduce((s, p) => s + p.marks, 0);
    const groupsSum = part.groups.reduce((s, g) => s + g.marks, 0);
    if (Math.abs(mustIncludeSum + groupsSum - part.marks) > RECONCILIATION_TOLERANCE) {
      throw new BadRequestException(
        `Part "${part.name}" points (${mustIncludeSum + groupsSum}) must sum to its marks (${part.marks})`,
      );
    }
    for (const group of part.groups) {
      if (group.minRequired > group.points.length) {
        throw new BadRequestException(
          `Group minRequired (${group.minRequired}) exceeds its point count (${group.points.length}) in part "${part.name}"`,
        );
      }
    }
  }
}

@Injectable()
export class AnswerCorrectionRubricService {
  constructor(private readonly prisma: PrismaService) {}

  // ----- Question Types -----

  listQuestionTypes() {
    return this.prisma.answerQuestionType.findMany({
      orderBy: { createdAt: 'desc' },
      include: { parts: { orderBy: { order: 'asc' } }, _count: { select: { questions: true } } },
    });
  }

  async getQuestionType(id: string) {
    const type = await this.prisma.answerQuestionType.findUnique({
      where: { id },
      include: { parts: { orderBy: { order: 'asc' } } },
    });
    if (!type) throw new NotFoundException('Question type not found');
    return type;
  }

  createQuestionType(user: JwtPayload, dto: CreateAnswerQuestionTypeDto) {
    return withUniqueNameCheck(
      () =>
        this.prisma.answerQuestionType.create({
          data: {
            name: dto.name,
            facultyId: user.sub,
            parts: {
              create: dto.parts.map((p, i) => ({
                partKey: p.partKey,
                name: p.name,
                order: p.order ?? i,
                defaultWeight: p.defaultWeight,
              })),
            },
          },
          include: { parts: { orderBy: { order: 'asc' } } },
        }),
      'question type',
    );
  }

  async updateQuestionType(id: string, dto: UpdateAnswerQuestionTypeDto) {
    await this.getQuestionType(id);
    return withUniqueNameCheck(
      () =>
        this.prisma.$transaction(async (tx) => {
          if (dto.parts) {
            await tx.answerQuestionTypePart.deleteMany({ where: { typeId: id } });
          }
          return tx.answerQuestionType.update({
            where: { id },
            data: {
              name: dto.name,
              parts: dto.parts
                ? { create: dto.parts.map((p, i) => ({ partKey: p.partKey, name: p.name, order: p.order ?? i, defaultWeight: p.defaultWeight })) }
                : undefined,
            },
            include: { parts: { orderBy: { order: 'asc' } } },
          });
        }, { maxWait: 15000, timeout: 15000 }),
      'question type',
    );
  }

  async deleteQuestionType(id: string) {
    const type = await this.prisma.answerQuestionType.findUnique({ where: { id }, include: { _count: { select: { questions: true } } } });
    if (!type) throw new NotFoundException('Question type not found');
    if (type._count.questions > 0) {
      throw new ConflictException('Cannot delete a question type that has questions using it');
    }
    await this.prisma.answerQuestionType.delete({ where: { id } });
    return { success: true };
  }

  // ----- Questions -----

  async listQuestions(user: JwtPayload, published?: boolean) {
    const where = user.role === 'ADMIN' ? (published ? { published: true } : {}) : { published: true };
    const questions = await this.prisma.answerQuestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { type: true, _count: { select: { submissions: true } } },
    });
    return questions.map((q) => (user.role === 'ADMIN' ? q : this.trimQuestionForConsumer(q)));
  }

  async getQuestion(id: string, user: JwtPayload) {
    const question = await this.fullQuestionInclude(id);
    if (!question) throw new NotFoundException('Question not found');
    if (user.role === 'ADMIN') return question;
    if (!question.published) throw new ForbiddenException('This question is not published');
    return this.trimQuestionForConsumer(question);
  }

  /** Full rubric, used internally by the grading service -- never exposed to non-ADMIN callers as-is. */
  async requireFullQuestionForGrading(id: string) {
    const question = await this.fullQuestionInclude(id);
    if (!question) throw new NotFoundException('Question not found');
    if (!question.published) throw new BadRequestException('This question is not published yet');
    return question;
  }

  private fullQuestionInclude(id: string) {
    return this.prisma.answerQuestion.findUnique({
      where: { id },
      include: {
        type: true,
        forbiddenPoints: true,
        parts: {
          orderBy: { order: 'asc' },
          include: { mustIncludePoints: true, groups: { include: { points: true } } },
        },
        _count: { select: { submissions: true } },
      },
    });
  }

  /** Withholds the answer key (modelAnswer, point marks, forbidden points) from non-ADMIN consumers pre-grading. */
  private trimQuestionForConsumer(question: { id: string; text: string; directive: string | null; maxMarks: number; typeId: string; published: boolean }) {
    return {
      id: question.id,
      text: question.text,
      directive: question.directive,
      maxMarks: question.maxMarks,
      typeId: question.typeId,
      published: question.published,
    };
  }

  async createQuestion(user: JwtPayload, dto: CreateAnswerQuestionDto) {
    validateRubricReconciliation(dto);
    const type = await this.prisma.answerQuestionType.findUnique({ where: { id: dto.typeId } });
    if (!type) throw new NotFoundException('Question type not found');

    return this.prisma.answerQuestion.create({
      data: {
        text: dto.text,
        directive: dto.directive,
        maxMarks: dto.maxMarks,
        modelAnswer: dto.modelAnswer,
        published: dto.published ?? false,
        facultyId: user.sub,
        typeId: dto.typeId,
        parts: {
          create: dto.parts.map((part, i) => ({
            partKey: part.partKey,
            name: part.name,
            order: part.order ?? i,
            marks: part.marks,
            mustIncludePoints: { create: part.mustInclude.map((p) => ({ text: p.text, marks: p.marks })) },
            groups: {
              create: part.groups.map((g) => ({
                minRequired: g.minRequired,
                marks: g.marks,
                points: { create: g.points.map((p) => ({ text: p.text, marks: 0 })) },
              })),
            },
          })),
        },
        forbiddenPoints: {
          create: (dto.forbiddenPoints ?? []).map((f) => ({
            text: f.text,
            category: f.category,
            penaltyType: f.penaltyType,
            penalty: f.penalty ?? 0,
          })),
        },
      },
      include: { parts: { include: { mustIncludePoints: true, groups: { include: { points: true } } } }, forbiddenPoints: true },
    });
  }

  async updateQuestion(id: string, dto: UpdateAnswerQuestionDto) {
    const existing = await this.fullQuestionInclude(id);
    if (!existing) throw new NotFoundException('Question not found');

    // If either maxMarks or parts is being changed, re-validate reconciliation against the merged state.
    if (dto.parts || dto.maxMarks !== undefined) {
      const maxMarks = dto.maxMarks ?? existing.maxMarks;
      const parts =
        dto.parts ??
        existing.parts.map((p) => ({
          partKey: p.partKey,
          name: p.name,
          order: p.order,
          marks: p.marks,
          mustInclude: p.mustIncludePoints.map((mp) => ({ text: mp.text, marks: mp.marks })),
          groups: p.groups.map((g) => ({ minRequired: g.minRequired, marks: g.marks, points: g.points.map((pt) => ({ text: pt.text })) })),
        }));
      validateRubricReconciliation({ maxMarks, parts });
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.parts) {
        await tx.answerQuestionPart.deleteMany({ where: { questionId: id } }); // cascades points/groups
      }
      if (dto.forbiddenPoints) {
        await tx.answerQuestionForbiddenPoint.deleteMany({ where: { questionId: id } });
      }
      return tx.answerQuestion.update({
        where: { id },
        data: {
          text: dto.text,
          directive: dto.directive,
          maxMarks: dto.maxMarks,
          modelAnswer: dto.modelAnswer,
          published: dto.published,
          typeId: dto.typeId,
          parts: dto.parts
            ? {
                create: dto.parts.map((part, i) => ({
                  partKey: part.partKey,
                  name: part.name,
                  order: part.order ?? i,
                  marks: part.marks,
                  mustIncludePoints: { create: part.mustInclude.map((p) => ({ text: p.text, marks: p.marks })) },
                  groups: {
                    create: part.groups.map((g) => ({
                      minRequired: g.minRequired,
                      marks: g.marks,
                      points: { create: g.points.map((p) => ({ text: p.text, marks: 0 })) },
                    })),
                  },
                })),
              }
            : undefined,
          forbiddenPoints: dto.forbiddenPoints
            ? {
                create: dto.forbiddenPoints.map((f) => ({ text: f.text, category: f.category, penaltyType: f.penaltyType, penalty: f.penalty ?? 0 })),
              }
            : undefined,
        },
        include: { parts: { include: { mustIncludePoints: true, groups: { include: { points: true } } } }, forbiddenPoints: true },
      });
    }, { maxWait: 15000, timeout: 15000 });
  }

  async deleteQuestion(id: string) {
    const question = await this.prisma.answerQuestion.findUnique({ where: { id }, include: { _count: { select: { submissions: true } } } });
    if (!question) throw new NotFoundException('Question not found');
    if (question._count.submissions > 0) {
      throw new ConflictException('Cannot delete a question that already has student submissions');
    }
    await this.prisma.answerQuestion.delete({ where: { id } });
    return { success: true };
  }
}
