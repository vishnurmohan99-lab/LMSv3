import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { QuestionType } from '../../generated/prisma/client';

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

@Injectable()
export class WorkoutService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuestions(user: JwtPayload, courseId: string, types: QuestionType[], count: number) {
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

    const questions = await this.prisma.question.findMany({
      where: {
        type: { in: types },
        questionBank: { facultyId: course.facultyId },
      },
      include: { tags: { select: { id: true, name: true } } },
    });

    return shuffle(questions).slice(0, count);
  }
}
