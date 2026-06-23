import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateFeedbackFormDto } from './dto/create-feedback-form.dto';
import { SubmitFeedbackResponseDto } from './dto/submit-feedback-response.dto';

const FORM_INCLUDE = {
  targetCourse: { select: { id: true, title: true } },
  targetFaculty: { select: { id: true, fullName: true } },
  batch: { select: { id: true, name: true } },
  _count: { select: { responses: true } },
} as const;

function questionRatingIndexes(questions: { type: string }[]) {
  return questions.reduce<number[]>((acc, q, i) => {
    if (q.type === 'RATING') acc.push(i);
    return acc;
  }, []);
}

function avgRating(questions: { type: string }[], answers: (string | number)[]) {
  const indexes = questionRatingIndexes(questions);
  if (indexes.length === 0) return null;
  const values = indexes.map((i) => Number(answers[i]) || 0);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function isAnswerEmpty(answer: unknown): boolean {
  if (Array.isArray(answer)) return answer.length === 0;
  return answer === undefined || answer === null || String(answer).trim() === '';
}

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async createForm(admin: JwtPayload, dto: CreateFeedbackFormDto) {
    if (dto.targetType === 'COURSE' && !dto.targetCourseId) throw new BadRequestException('targetCourseId is required for course feedback');
    if ((dto.targetType === 'FACULTY' || dto.targetType === 'MENTOR') && !dto.targetFacultyId) {
      throw new BadRequestException('targetFacultyId is required for faculty/mentor feedback');
    }
    if (dto.targetType === 'SYSTEM' && !dto.targetSystemArea?.trim()) throw new BadRequestException('targetSystemArea is required for system feedback');

    if (dto.assignType === 'BATCH' && !dto.batchId) throw new BadRequestException('batchId is required when assigning to a batch');
    if (dto.assignType === 'SELECTED' && (!dto.studentIds || dto.studentIds.length === 0)) {
      throw new BadRequestException('studentIds is required when assigning to selected students');
    }

    const form = await this.prisma.feedbackForm.create({
      data: {
        title: dto.title.trim(),
        targetType: dto.targetType,
        targetCourseId: dto.targetType === 'COURSE' ? dto.targetCourseId : null,
        targetFacultyId: dto.targetType === 'FACULTY' || dto.targetType === 'MENTOR' ? dto.targetFacultyId : null,
        targetSystemArea: dto.targetType === 'SYSTEM' ? dto.targetSystemArea!.trim() : null,
        questions: dto.questions as object,
        assignType: dto.assignType,
        batchId: dto.assignType === 'BATCH' ? dto.batchId : null,
        createdById: admin.sub,
        recipients:
          dto.assignType === 'SELECTED'
            ? { createMany: { data: dto.studentIds!.map((studentId) => ({ studentId })) } }
            : undefined,
      },
      include: FORM_INCLUDE,
    });
    return form;
  }

  async listForms() {
    const forms = await this.prisma.feedbackForm.findMany({ orderBy: { createdAt: 'desc' }, include: FORM_INCLUDE });
    const allResponses = await this.prisma.feedbackResponse.findMany({ select: { formId: true, answers: true } });
    const byForm = new Map<string, (string | number)[][]>();
    for (const r of allResponses) {
      const list = byForm.get(r.formId) ?? [];
      list.push(r.answers as (string | number)[]);
      byForm.set(r.formId, list);
    }
    return forms.map((f) => {
      const responses = byForm.get(f.id) ?? [];
      const ratings = responses.map((a) => avgRating(f.questions as { type: string }[], a)).filter((v): v is number => v !== null);
      const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      return { ...f, avgRating: avg };
    });
  }

  async getFormForAdmin(id: string) {
    const form = await this.prisma.feedbackForm.findUnique({
      where: { id },
      include: {
        ...FORM_INCLUDE,
        responses: { include: { student: { select: { id: true, fullName: true, email: true } } }, orderBy: { submittedAt: 'desc' } },
      },
    });
    if (!form) throw new NotFoundException('Feedback form not found');
    const questions = form.questions as { type: string; label: string }[];
    const responses = form.responses.map((r) => ({ ...r, rating: avgRating(questions, r.answers as (string | number)[]) }));
    const ratings = responses.map((r) => r.rating).filter((v): v is number => v !== null);
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    return { ...form, responses, avgRating: avg };
  }

  private async isAssignedToStudent(form: { id: string; assignType: string; batchId: string | null }, studentId: string) {
    if (form.assignType === 'SELECTED') {
      const recipient = await this.prisma.feedbackRecipient.findUnique({
        where: { formId_studentId: { formId: form.id, studentId } },
      });
      return !!recipient;
    }
    if (form.assignType === 'BATCH' && form.batchId) {
      const enrollment = await this.prisma.batchEnrollment.findUnique({
        where: { batchId_studentId: { batchId: form.batchId, studentId } },
      });
      return !!enrollment;
    }
    return false;
  }

  async listMyForms(student: JwtPayload) {
    const [batchForms, selectedForms] = await Promise.all([
      this.prisma.feedbackForm.findMany({
        where: { assignType: 'BATCH', batch: { enrollments: { some: { studentId: student.sub } } } },
        include: FORM_INCLUDE,
      }),
      this.prisma.feedbackForm.findMany({
        where: { assignType: 'SELECTED', recipients: { some: { studentId: student.sub } } },
        include: FORM_INCLUDE,
      }),
    ]);
    const forms = [...batchForms, ...selectedForms].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const myResponses = await this.prisma.feedbackResponse.findMany({
      where: { studentId: student.sub, formId: { in: forms.map((f) => f.id) } },
    });
    const submittedFormIds = new Set(myResponses.map((r) => r.formId));
    return forms.map((f) => ({ ...f, submitted: submittedFormIds.has(f.id) }));
  }

  async getFormForFill(id: string, student: JwtPayload) {
    const form = await this.prisma.feedbackForm.findUnique({ where: { id }, include: FORM_INCLUDE });
    if (!form) throw new NotFoundException('Feedback form not found');
    const assigned = await this.isAssignedToStudent(form, student.sub);
    if (!assigned) throw new ForbiddenException('This feedback form is not assigned to you');
    const myResponse = await this.prisma.feedbackResponse.findUnique({
      where: { formId_studentId: { formId: id, studentId: student.sub } },
    });
    return { ...form, myResponse };
  }

  async submitResponse(id: string, student: JwtPayload, dto: SubmitFeedbackResponseDto) {
    const form = await this.prisma.feedbackForm.findUnique({ where: { id } });
    if (!form) throw new NotFoundException('Feedback form not found');
    const assigned = await this.isAssignedToStudent(form, student.sub);
    if (!assigned) throw new ForbiddenException('This feedback form is not assigned to you');

    const questions = form.questions as { type: string; label: string; required?: boolean }[];
    if (dto.answers.length !== questions.length) throw new BadRequestException('answers must match the number of questions');

    questions.forEach((q, i) => {
      if (q.required && isAnswerEmpty(dto.answers[i])) {
        throw new BadRequestException(`"${q.label}" is required`);
      }
    });

    try {
      return await this.prisma.feedbackResponse.create({
        data: { formId: id, studentId: student.sub, answers: dto.answers },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw new ConflictException('You have already submitted this feedback form');
      throw err;
    }
  }
}
