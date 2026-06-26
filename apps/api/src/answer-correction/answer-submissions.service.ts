import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { AnswerCorrectionRubricService } from './answer-correction-rubric.service';
import { AnswerGradingService } from './answer-grading.service';
import { CreateAnswerSubmissionDto } from './dto/create-answer-submission.dto';
import { GradeAnswerSubmissionDto } from './dto/grade-answer-submission.dto';
import { GradingResult } from './grading-contract';

@Injectable()
export class AnswerSubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rubric: AnswerCorrectionRubricService,
    private readonly grading: AnswerGradingService,
  ) {}

  async createAndGrade(user: JwtPayload, dto: CreateAnswerSubmissionDto): Promise<{ status: 'GRADED' | 'FAILED'; result?: GradingResult; errorMessage?: string }> {
    const question = await this.rubric.requireFullQuestionForGrading(dto.questionId);

    const submission = await this.prisma.answerSubmission.create({
      data: {
        questionId: dto.questionId,
        studentId: user.sub,
        fileKey: dto.fileKey,
        fileType: dto.fileType,
        status: 'PROCESSING',
      },
    });

    try {
      const result = await this.grading.gradeSubmission(submission, question);
      await this.prisma.answerEvaluation.create({
        data: {
          submissionId: submission.id,
          transcript: result.transcript as object,
          marksAwarded: result.overall.marks,
          marksMax: result.overall.max,
          verdict: result.overall.verdict,
          parts: result.parts as object,
          forbiddenFound: result.forbiddenFound as object,
          bonusPoints: result.bonusPoints as object,
          modelAnswerRef: result.modelAnswerRef,
          upgradedAnswer: result.upgradedAnswer,
        },
      });
      await this.prisma.answerSubmission.update({ where: { id: submission.id }, data: { status: 'GRADED' } });
      return { status: 'GRADED', result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Grading failed';
      await this.prisma.answerSubmission.update({ where: { id: submission.id }, data: { status: 'FAILED', errorMessage } });
      return { status: 'FAILED', errorMessage };
    }
  }

  async listMine(user: JwtPayload) {
    const submissions = await this.prisma.answerSubmission.findMany({
      where: { studentId: user.sub },
      orderBy: { createdAt: 'desc' },
      include: { question: { select: { text: true } }, evaluation: { select: { marksAwarded: true, marksMax: true } } },
    });
    return submissions.map((s) => ({
      id: s.id,
      questionId: s.questionId,
      questionText: s.question.text,
      status: s.status,
      marksAwarded: s.evaluation?.marksAwarded,
      marksMax: s.evaluation?.marksMax,
      createdAt: s.createdAt,
    }));
  }

  /** FACULTY/ADMIN grading queue -- all students' submissions, optionally filtered by question. */
  async listAll(questionId?: string) {
    const submissions = await this.prisma.answerSubmission.findMany({
      where: questionId ? { questionId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        question: { select: { text: true } },
        student: { select: { fullName: true } },
        evaluation: { select: { marksAwarded: true, marksMax: true, manualGradedAt: true } },
      },
    });
    return submissions.map((s) => ({
      id: s.id,
      questionId: s.questionId,
      questionText: s.question.text,
      studentName: s.student.fullName,
      status: s.status,
      marksAwarded: s.evaluation?.marksAwarded,
      marksMax: s.evaluation?.marksMax,
      manualGradedAt: s.evaluation?.manualGradedAt ?? null,
      createdAt: s.createdAt,
    }));
  }

  async getById(id: string, user: JwtPayload): Promise<GradingResult> {
    const submission = await this.requireSubmissionWithEvaluation(id);
    if (user.role === 'STUDENT' && submission.studentId !== user.sub) {
      throw new ForbiddenException('You do not have access to this submission');
    }
    if (!submission.evaluation) {
      throw new BadRequestException(`Submission is ${submission.status.toLowerCase()}, no evaluation available yet`);
    }
    return this.toGradingResult(submission);
  }

  async gradeManually(id: string, user: JwtPayload, dto: GradeAnswerSubmissionDto): Promise<GradingResult> {
    const submission = await this.requireSubmissionWithEvaluation(id);
    if (!submission.evaluation) {
      throw new BadRequestException('Submission has not been AI-graded yet, cannot manually grade');
    }
    if (dto.marksAwarded > submission.evaluation.marksMax) {
      throw new BadRequestException(`marksAwarded (${dto.marksAwarded}) cannot exceed the question's max marks (${submission.evaluation.marksMax})`);
    }

    await this.prisma.answerEvaluation.update({
      where: { id: submission.evaluation.id },
      data: {
        manualMarksAwarded: dto.marksAwarded,
        manualComment: dto.comment,
        manualGradedById: user.sub,
        manualGradedAt: new Date(),
      },
    });

    const updated = await this.requireSubmissionWithEvaluation(id);
    return this.toGradingResult(updated);
  }

  private async requireSubmissionWithEvaluation(id: string) {
    const submission = await this.prisma.answerSubmission.findUnique({
      where: { id },
      include: { evaluation: { include: { manualGradedBy: { select: { fullName: true } } } }, question: { select: { id: true, typeId: true } } },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  private toGradingResult(submission: Awaited<ReturnType<AnswerSubmissionsService['requireSubmissionWithEvaluation']>>): GradingResult {
    const e = submission.evaluation!;
    return {
      submissionId: submission.id,
      questionId: submission.question.id,
      typeId: submission.question.typeId,
      transcript: e.transcript as unknown as GradingResult['transcript'],
      overall: { marks: e.marksAwarded, max: e.marksMax, verdict: e.verdict },
      parts: e.parts as unknown as GradingResult['parts'],
      forbiddenFound: e.forbiddenFound as unknown as GradingResult['forbiddenFound'],
      bonusPoints: e.bonusPoints as unknown as GradingResult['bonusPoints'],
      modelAnswerRef: e.modelAnswerRef,
      upgradedAnswer: e.upgradedAnswer,
      manualGrade:
        e.manualGradedAt && e.manualMarksAwarded !== null
          ? {
              marksAwarded: e.manualMarksAwarded,
              comment: e.manualComment,
              gradedByName: e.manualGradedBy?.fullName ?? 'Unknown',
              gradedAt: e.manualGradedAt.toISOString(),
            }
          : null,
    };
  }
}
