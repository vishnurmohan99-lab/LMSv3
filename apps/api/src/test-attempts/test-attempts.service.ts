import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { SaveAnswerDto } from './dto/save-answer.dto';

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

@Injectable()
export class TestAttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async startAttempt(user: JwtPayload, testId: string) {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (!test.courseId) throw new BadRequestException('This test is not a mock test and cannot be attempted directly');
    if (!test.published) throw new ForbiddenException('This mock test is not published yet');

    if (user.role === 'STUDENT') {
      const enrolled = await this.prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.sub, courseId: test.courseId } },
      });
      if (!enrolled) throw new ForbiddenException('You are not enrolled in this course');
    }

    if (test.publishMode === 'TIMED') {
      const now = new Date();
      if (test.availableFrom && now < test.availableFrom) throw new ForbiddenException('This mock test is not open yet');
      if (test.availableUntil && now > test.availableUntil) throw new ForbiddenException('This mock test has closed');
    }

    const attempt = await this.prisma.testAttempt.create({
      data: { testId, studentId: user.sub },
    });

    const testQuestions = await this.prisma.testQuestion.findMany({
      where: { testId },
      orderBy: { order: 'asc' },
      select: { id: true, type: true, prompt: true, options: true, order: true, testId: true },
    });

    return { ...attempt, testQuestions };
  }

  async listMine(user: JwtPayload, testId: string) {
    return this.prisma.testAttempt.findMany({
      where: { testId, studentId: user.sub },
      orderBy: { startedAt: 'desc' },
    });
  }

  async saveAnswer(user: JwtPayload, attemptId: string, dto: SaveAnswerDto) {
    const attempt = await this.requireOwnAttempt(user, attemptId);
    await this.assertWithinDeadline(attempt);

    const question = await this.prisma.testQuestion.findUnique({ where: { id: dto.testQuestionId } });
    if (!question || question.testId !== attempt.testId) {
      throw new BadRequestException('This question does not belong to this test');
    }

    return this.prisma.testAnswer.upsert({
      where: { attemptId_testQuestionId: { attemptId, testQuestionId: dto.testQuestionId } },
      create: { attemptId, testQuestionId: dto.testQuestionId, selectedOption: dto.selectedOption },
      update: { selectedOption: dto.selectedOption },
    });
  }

  async submitAttempt(user: JwtPayload, attemptId: string) {
    const attempt = await this.requireOwnAttempt(user, attemptId);

    const testQuestions = await this.prisma.testQuestion.findMany({ where: { testId: attempt.testId } });
    const answers = await this.prisma.testAnswer.findMany({ where: { attemptId } });
    const answerByQuestion = new Map(answers.map((a) => [a.testQuestionId, a]));

    let score = 0;
    await this.prisma.$transaction(
      async (tx) => {
        for (const q of testQuestions) {
          const answer = answerByQuestion.get(q.id);
          const isCorrect = !!answer && normalize(answer.selectedOption) === normalize(q.correctOption) && normalize(q.correctOption).length > 0;
          if (isCorrect) score++;
          if (answer) {
            await tx.testAnswer.update({ where: { id: answer.id }, data: { isCorrect } });
          }
        }
        await tx.testAttempt.update({
          where: { id: attemptId },
          data: { status: 'SUBMITTED', submittedAt: new Date(), score, maxScore: testQuestions.length },
        });
      },
      { maxWait: 15000, timeout: 15000 },
    );

    return this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: { include: { testQuestion: true } } },
    });
  }

  private async requireOwnAttempt(user: JwtPayload, attemptId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({ where: { id: attemptId }, include: { test: true } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.studentId !== user.sub) throw new ForbiddenException('This is not your attempt');
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestException('This attempt has already been submitted');
    return attempt;
  }

  private async assertWithinDeadline(attempt: { startedAt: Date; test: { publishMode: string; durationMinutes: number | null; availableUntil: Date | null } }) {
    if (attempt.test.publishMode !== 'TIMED') return;
    const now = new Date();
    if (attempt.test.availableUntil && now > attempt.test.availableUntil) {
      throw new BadRequestException('The time window for this mock test has closed');
    }
    if (attempt.test.durationMinutes) {
      const deadline = new Date(attempt.startedAt.getTime() + attempt.test.durationMinutes * 60000);
      if (now > deadline) throw new BadRequestException('Time is up for this attempt');
    }
  }
}
