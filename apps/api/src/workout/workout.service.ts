import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Prisma, QuestionType } from '../../generated/prisma/client';

function isOwnerOrAdmin(user: JwtPayload, facultyId: string) {
  return user.role === 'ADMIN' || user.sub === facultyId;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Comprehension sub-questions are always one of the auto-gradable types, never ESSAY.
const COMPREHENSION_TYPES: QuestionType[] = ['MCQ', 'TRUE_FALSE', 'FILL_BLANK'];

@Injectable()
export class WorkoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  async getQuestions(user: JwtPayload, courseId: string, types: QuestionType[], count: number, includeComprehension: boolean) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    if (user.role === 'STUDENT') {
      const enrolled = await this.prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.sub, courseId } },
      });
      if (!enrolled) throw new ForbiddenException('You are not enrolled in this course');
    } else if (!isOwnerOrAdmin(user, course.facultyId)) {
      throw new ForbiddenException('You do not have access to this course');
    }

    // Standalone (non-comprehension) questions of the chosen formats, plus — when requested —
    // comprehension sub-questions (which always carry a passage). Excluding passage-bound
    // questions from the standalone set keeps a plain MCQ workout from surfacing questions that
    // are unanswerable without their passage.
    const or: Prisma.QuestionWhereInput[] = [];
    if (types.length > 0) or.push({ passageId: null, type: { in: types } });
    if (includeComprehension) or.push({ passageId: { not: null }, type: { in: COMPREHENSION_TYPES } });
    if (or.length === 0) throw new BadRequestException('Select at least one question format');

    const questions = await this.prisma.question.findMany({
      where: {
        questionBank: { facultyId: course.facultyId },
        OR: or,
      },
      include: { tags: { select: { id: true, name: true } }, passage: true },
    });

    const selected = shuffle(questions).slice(0, count);
    return Promise.all(
      selected.map(async (q) => ({
        ...q,
        imageUrl: q.imageUrl ? await this.uploads.presignDownload(q.imageUrl) : null,
        passage: q.passage
          ? { ...q.passage, imageUrl: q.passage.imageUrl ? await this.uploads.presignDownload(q.passage.imageUrl) : null }
          : null,
      })),
    );
  }
}
