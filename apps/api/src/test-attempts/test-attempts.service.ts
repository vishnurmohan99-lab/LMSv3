import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { SaveAnswerDto } from './dto/save-answer.dto';

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

@Injectable()
export class TestAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  async startAttempt(user: JwtPayload, testId: string) {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (!test.published) throw new ForbiddenException('This mock test is not published yet');

    if (test.courseId) {
      if (user.role === 'STUDENT') {
        const enrolled = await this.prisma.enrollment.findUnique({
          where: { studentId_courseId: { studentId: user.sub, courseId: test.courseId } },
        });
        if (!enrolled) throw new ForbiddenException('You are not enrolled in this course');
      }
    } else if (test.type === 'PAID') {
      // Standalone paid test — must be linked to a subscription plan the student has paid into.
      const subTest = await this.prisma.subscriptionTest.findFirst({ where: { testId } });
      if (!subTest) throw new BadRequestException('This test is paid but not yet linked to a subscription plan — contact admin');
      if (user.role === 'STUDENT') {
        const subEnrolled = await this.prisma.subscriptionEnrollment.findUnique({
          where: { subscriptionId_studentId: { subscriptionId: subTest.subscriptionId, studentId: user.sub } },
        });
        if (!subEnrolled) throw new ForbiddenException('You need an active subscription to attempt this test');
      }
    }
    // Standalone FREE tests need no further gate — visibility is already governed by segment/subsegment matching.

    if (test.publishMode === 'TIMED') {
      const now = new Date();
      if (test.availableFrom && now < test.availableFrom) throw new ForbiddenException('This mock test is not open yet');
      if (test.availableUntil && now > test.availableUntil) throw new ForbiddenException('This mock test has closed');
    }

    const attempt = await this.prisma.testAttempt.create({
      data: { testId, studentId: user.sub },
    });

    const rawQuestions = await this.prisma.testQuestion.findMany({
      where: { testId },
      orderBy: { order: 'asc' },
      select: { id: true, type: true, prompt: true, options: true, order: true, testId: true, imageUrl: true, passage: true, marks: true, negativeMarks: true, difficulty: true, answerTimeSeconds: true, tags: { select: { id: true, name: true } } },
    });
    const testQuestions = await Promise.all(
      rawQuestions.map(async (q) => ({
        ...q,
        imageUrl: q.imageUrl ? await this.uploads.presignDownload(q.imageUrl) : null,
        passage: q.passage
          ? { ...q.passage, imageUrl: q.passage.imageUrl ? await this.uploads.presignDownload(q.passage.imageUrl) : null }
          : null,
      })),
    );

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

    // Marks-based scoring: each question is worth `marks` (default 1) for a correct answer, and
    // deducts `negativeMarks` (default 0) for a wrong answer. Unanswered questions score 0. The
    // final total is clamped at 0 so negative marking can't push a student below zero. With the
    // defaults (marks=1, negativeMarks=0) this is identical to the previous count-based scoring.
    let score = 0;
    const maxScore = testQuestions.reduce((sum, q) => sum + (q.marks ?? 1), 0);
    await this.prisma.$transaction(
      async (tx) => {
        for (const q of testQuestions) {
          const answer = answerByQuestion.get(q.id);
          const answered = !!answer && normalize(answer.selectedOption).length > 0;
          const isCorrect = answered && normalize(answer!.selectedOption) === normalize(q.correctOption) && normalize(q.correctOption).length > 0;
          if (isCorrect) score += q.marks ?? 1;
          else if (answered) score -= q.negativeMarks ?? 0;
          if (answer) {
            await tx.testAnswer.update({ where: { id: answer.id }, data: { isCorrect } });
          }
        }
        await tx.testAttempt.update({
          where: { id: attemptId },
          data: { status: 'SUBMITTED', submittedAt: new Date(), score: Math.max(0, score), maxScore },
        });
      },
      { maxWait: 15000, timeout: 15000 },
    );

    return this.prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: { include: { testQuestion: true } } },
    });
  }

  async getLeaderboard(user: JwtPayload, testId: string) {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');

    const attempts = await this.prisma.testAttempt.findMany({
      where: { testId, status: 'SUBMITTED', score: { not: null } },
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: { score: 'desc' },
    });

    const bestByStudent = new Map<string, (typeof attempts)[number]>();
    for (const a of attempts) {
      const existing = bestByStudent.get(a.studentId);
      if (!existing || (a.score ?? 0) > (existing.score ?? 0)) bestByStudent.set(a.studentId, a);
    }

    const ranked = [...bestByStudent.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // Per-entry accuracy (correct / answered) and time-taken — the standalone leaderboard
    // screen surfaces both. Derived in one pass over the ranked attempts' answers rather
    // than per-row queries.
    const rankedIds = ranked.map((a) => a.id);
    const answers = await this.prisma.testAnswer.findMany({
      where: { attemptId: { in: rankedIds } },
      select: { attemptId: true, isCorrect: true, selectedOption: true },
    });
    const statByAttempt = new Map<string, { answered: number; correct: number }>();
    for (const ans of answers) {
      const s = statByAttempt.get(ans.attemptId) ?? { answered: 0, correct: 0 };
      const didAnswer = ans.selectedOption != null && ans.selectedOption !== '';
      if (didAnswer) s.answered += 1;
      if (ans.isCorrect) s.correct += 1;
      statByAttempt.set(ans.attemptId, s);
    }

    const toEntry = (a: (typeof ranked)[number], rank: number) => {
      const stat = statByAttempt.get(a.id);
      const accuracy = stat && stat.answered > 0 ? stat.correct / stat.answered : null;
      const timeSeconds =
        a.submittedAt && a.startedAt ? Math.max(0, Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 1000)) : null;
      return {
        rank,
        studentId: a.studentId,
        studentName: a.student.fullName,
        score: a.score,
        maxScore: a.maxScore,
        accuracy,
        timeSeconds,
        isMe: a.studentId === user.sub,
      };
    };

    // Enough rows for the podium (top 3) plus the table beneath it.
    const top = ranked.slice(0, 20).map((a, i) => toEntry(a, i + 1));

    const myIndex = ranked.findIndex((a) => a.studentId === user.sub);
    const me = myIndex >= 20 ? toEntry(ranked[myIndex], myIndex + 1) : null;

    return { top, me, totalRanked: ranked.length };
  }

  /**
   * Every SUBMITTED attempt the student has made, across all tests, oldest-first — the
   * data behind Results & Analytics. Each row carries score, accuracy (correct/answered),
   * time taken, and the attempt's percentile within that test's field of best-per-student
   * scores. (Batch median and per-subject accuracy are not derivable here — no batch model
   * and no cross-attempt tag rollup — so they stay client-side "needs API" affordances.)
   */
  async getMyResults(user: JwtPayload) {
    const mine = await this.prisma.testAttempt.findMany({
      where: { studentId: user.sub, status: 'SUBMITTED', score: { not: null } },
      include: { test: { select: { id: true, title: true } } },
      orderBy: { submittedAt: 'asc' },
    });
    if (mine.length === 0) return { attempts: [], subjects: [] };

    // Accuracy per attempt, in one pass over the relevant answers.
    const attemptIds = mine.map((a) => a.id);
    const answers = await this.prisma.testAnswer.findMany({
      where: { attemptId: { in: attemptIds } },
      select: { attemptId: true, testQuestionId: true, isCorrect: true, selectedOption: true },
    });
    const stat = new Map<string, { answered: number; correct: number }>();
    for (const ans of answers) {
      const s = stat.get(ans.attemptId) ?? { answered: 0, correct: 0 };
      if (ans.selectedOption != null && ans.selectedOption !== '') s.answered += 1;
      if (ans.isCorrect) s.correct += 1;
      stat.set(ans.attemptId, s);
    }

    // Accuracy by subject: attribute each answered question's correctness to its tags.
    const testIdsAll = [...new Set(mine.map((a) => a.testId))];
    const questions = await this.prisma.testQuestion.findMany({
      where: { testId: { in: testIdsAll } },
      select: { id: true, tags: { select: { name: true } } },
    });
    const tagsByQuestion = new Map(questions.map((q) => [q.id, q.tags.map((t) => t.name)]));
    const subjectStat = new Map<string, { correct: number; total: number }>();
    for (const ans of answers) {
      const answered = ans.selectedOption != null && ans.selectedOption !== '';
      if (!answered) continue;
      for (const tag of tagsByQuestion.get(ans.testQuestionId) ?? []) {
        const s = subjectStat.get(tag) ?? { correct: 0, total: 0 };
        s.total += 1;
        if (ans.isCorrect) s.correct += 1;
        subjectStat.set(tag, s);
      }
    }
    const subjects = [...subjectStat.entries()]
      .map(([name, s]) => ({ name, correct: s.correct, total: s.total, pct: Math.round((s.correct / s.total) * 100) }))
      .sort((a, b) => a.pct - b.pct);

    // Percentile is relative to each test's field: gather best-per-student scores once per
    // distinct test, then read each attempt's standing off the sorted list.
    const fieldByTest = new Map<string, number[]>();
    for (const testId of testIdsAll) {
      const attempts = await this.prisma.testAttempt.findMany({
        where: { testId, status: 'SUBMITTED', score: { not: null } },
        select: { studentId: true, score: true },
      });
      const best = new Map<string, number>();
      for (const a of attempts) {
        const s = a.score ?? 0;
        if (!best.has(a.studentId) || s > (best.get(a.studentId) ?? 0)) best.set(a.studentId, s);
      }
      fieldByTest.set(testId, [...best.values()].sort((x, y) => x - y));
    }

    const attempts = mine.map((a) => {
      const st = stat.get(a.id);
      const accuracy = st && st.answered > 0 ? st.correct / st.answered : null;
      const timeSeconds =
        a.submittedAt && a.startedAt ? Math.max(0, Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 1000)) : null;
      const field = fieldByTest.get(a.testId) ?? [];
      const below = field.filter((s) => s < (a.score ?? 0)).length;
      const percentile = field.length > 1 ? Math.round((below / field.length) * 100) : null;
      const scorePct = a.maxScore ? Math.round(((a.score ?? 0) / a.maxScore) * 100) : 0;
      return {
        attemptId: a.id,
        testId: a.testId,
        testTitle: a.test.title,
        submittedAt: a.submittedAt,
        score: a.score,
        maxScore: a.maxScore,
        scorePct,
        accuracy,
        timeSeconds,
        percentile,
      };
    });

    return { attempts, subjects };
  }

  /** Detailed per-question review of the student's own SUBMITTED attempt, plus time taken and percentile. */
  async getAttemptReview(user: JwtPayload, attemptId: string) {
    const attempt = await this.prisma.testAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.studentId !== user.sub) throw new ForbiddenException('This is not your attempt');
    if (attempt.status !== 'SUBMITTED') throw new BadRequestException('This attempt has not been submitted yet');

    const questions = await this.prisma.testQuestion.findMany({
      where: { testId: attempt.testId },
      orderBy: { order: 'asc' },
      select: { id: true, type: true, prompt: true, options: true, correctOption: true, imageUrl: true, marks: true, negativeMarks: true, tags: { select: { id: true, name: true } }, passage: { select: { id: true } } },
    });
    const answers = await this.prisma.testAnswer.findMany({ where: { attemptId } });
    const answerByQuestion = new Map(answers.map((a) => [a.testQuestionId, a]));

    const reviewQuestions = await Promise.all(
      questions.map(async (q) => {
        const ans = answerByQuestion.get(q.id);
        const selectedOption = ans?.selectedOption ?? null;
        return {
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          correctOption: q.correctOption,
          selectedOption,
          answered: selectedOption != null && selectedOption !== '',
          isCorrect: !!ans?.isCorrect,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          tags: q.tags,
          hasPassage: !!q.passage,
          imageUrl: q.imageUrl ? await this.uploads.presignDownload(q.imageUrl) : null,
        };
      }),
    );

    const timeTakenSeconds = attempt.submittedAt
      ? Math.max(0, Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000))
      : null;

    // Percentile from best score per student among all submitted attempts for this test.
    const allAttempts = await this.prisma.testAttempt.findMany({
      where: { testId: attempt.testId, status: 'SUBMITTED', score: { not: null } },
      select: { studentId: true, score: true },
    });
    const bestByStudent = new Map<string, number>();
    for (const a of allAttempts) {
      const s = a.score ?? 0;
      if (s > (bestByStudent.get(a.studentId) ?? -1)) bestByStudent.set(a.studentId, s);
    }
    const myBest = bestByStudent.get(user.sub) ?? attempt.score ?? 0;
    const totalStudents = bestByStudent.size;
    const below = [...bestByStudent.values()].filter((s) => s < myBest).length;
    // "You scored higher than N% of test-takers." 100 when you're the only/top scorer.
    const percentile = totalStudents > 1 ? Math.round((below / (totalStudents - 1)) * 100) : 100;

    return {
      score: attempt.score,
      maxScore: attempt.maxScore,
      timeTakenSeconds,
      percentile,
      totalStudents,
      questions: reviewQuestions,
    };
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
