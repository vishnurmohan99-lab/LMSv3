import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import Papa from 'papaparse';
import { PrismaService } from '../prisma/prisma.service';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { withUniqueNameCheck } from '../common/unique-violation';
import { Prisma } from '../../generated/prisma/client';

function isOwnerOrAdmin(user: JwtPayload, facultyId: string) {
  return user.role === 'ADMIN' || user.sub === facultyId;
}

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bulkOperations: BulkOperationsService,
  ) {}

  listAllBatches() {
    return this.prisma.batch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { course: { select: { id: true, title: true } }, status: true, _count: { select: { enrollments: true } } },
    });
  }

  async listBatches(courseId: string, user: JwtPayload) {
    const course = await this.requireCourse(courseId);
    this.assertOwnership(user, course.facultyId);
    return this.prisma.batch.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      include: { status: true, _count: { select: { enrollments: true, sessions: true } } },
    });
  }

  async getBatch(id: string, user: JwtPayload) {
    const batch = await this.requireBatchWithCourse(id);
    this.assertOwnership(user, batch.course.facultyId);
    return this.prisma.batch.findUnique({
      where: { id },
      include: {
        status: true,
        enrollments: { include: { student: { select: { id: true, fullName: true, email: true } } } },
        sessions: { orderBy: { scheduledAt: 'asc' } },
        _count: { select: { enrollments: true, sessions: true } },
      },
    });
  }

  async createBatch(courseId: string, user: JwtPayload, dto: CreateBatchDto) {
    const course = await this.requireCourse(courseId);
    this.assertOwnership(user, course.facultyId);
    const statusId = dto.statusId ?? (await this.requireDefaultStatus()).id;
    return withUniqueNameCheck(
      () =>
        this.prisma.batch.create({
          data: {
            name: dto.name,
            statusId,
            startDate: new Date(dto.startDate),
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            facultyId: dto.facultyId,
            courseId,
          },
        }),
      'batch',
    );
  }

  async updateBatch(id: string, user: JwtPayload, dto: UpdateBatchDto) {
    const batch = await this.requireBatchWithCourse(id);
    this.assertOwnership(user, batch.course.facultyId);
    return withUniqueNameCheck(
      () =>
        this.prisma.batch.update({
          where: { id },
          data: {
            ...dto,
            startDate: dto.startDate ? new Date(dto.startDate) : undefined,
            endDate: dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : undefined,
          },
        }),
      'batch',
    );
  }

  async deleteBatch(id: string, user: JwtPayload) {
    const batch = await this.requireBatchWithCourse(id);
    this.assertOwnership(user, batch.course.facultyId);
    await this.prisma.batch.delete({ where: { id } });
    return { success: true };
  }

  async extendBatch(id: string, user: JwtPayload, newEndDate: string) {
    const batch = await this.requireBatchWithCourse(id);
    this.assertOwnership(user, batch.course.facultyId);
    const endDate = new Date(newEndDate);

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.batch.update({ where: { id }, data: { endDate } });
        await tx.batchEnrollment.updateMany({ where: { batchId: id }, data: { accessExpiresAt: endDate } });
        return updated;
      },
      { maxWait: 15000, timeout: 15000 },
    );
  }

  async getStats(user: JwtPayload) {
    const courseFilter = user.role === 'ADMIN' ? {} : { course: { facultyId: user.sub } };

    const batches = await this.prisma.batch.findMany({
      where: courseFilter,
      include: {
        status: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
        _count: { select: { enrollments: true } },
      },
    });

    const byStatus = new Map<string, { statusId: string; name: string; count: number }>();
    const byCourse = new Map<string, { courseId: string; courseTitle: string; byStatus: Map<string, { statusId: string; name: string; count: number }> }>();

    for (const batch of batches) {
      const statusEntry = byStatus.get(batch.statusId) ?? { statusId: batch.statusId, name: batch.status.name, count: 0 };
      statusEntry.count++;
      byStatus.set(batch.statusId, statusEntry);

      const courseEntry =
        byCourse.get(batch.courseId) ?? { courseId: batch.courseId, courseTitle: batch.course.title, byStatus: new Map() };
      const courseStatusEntry =
        courseEntry.byStatus.get(batch.statusId) ?? { statusId: batch.statusId, name: batch.status.name, count: 0 };
      courseStatusEntry.count++;
      courseEntry.byStatus.set(batch.statusId, courseStatusEntry);
      byCourse.set(batch.courseId, courseEntry);
    }

    return {
      totalBatches: batches.length,
      totalLearners: batches.reduce((sum, b) => sum + b._count.enrollments, 0),
      byStatus: [...byStatus.values()],
      byCourse: [...byCourse.values()].map((c) => ({ courseId: c.courseId, courseTitle: c.courseTitle, byStatus: [...c.byStatus.values()] })),
    };
  }

  async enrollStudent(batchId: string, user: JwtPayload, studentId: string) {
    const batch = await this.requireBatchWithCourse(batchId);
    this.assertOwnership(user, batch.course.facultyId);
    try {
      return await this.prisma.batchEnrollment.create({ data: { batchId, studentId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This student is already enrolled in this batch');
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BadRequestException('Student not found');
      }
      throw err;
    }
  }

  async bulkEnroll(batchId: string, user: JwtPayload, studentIds: string[]) {
    const batch = await this.requireBatchWithCourse(batchId);
    this.assertOwnership(user, batch.course.facultyId);

    const validStudents = await this.prisma.user.findMany({
      where: { id: { in: studentIds }, role: 'STUDENT' },
      select: { id: true },
    });
    if (validStudents.length === 0) {
      throw new BadRequestException('None of the provided student IDs are valid students');
    }

    const newIds = await this.diffNewEnrollments(batchId, validStudents.map((s) => s.id));
    const { bulkOperationId } = await this.insertEnrollmentsAndRecord(batchId, user, newIds);
    return { enrolled: newIds.length, skipped: validStudents.length - newIds.length, bulkOperationId };
  }

  async enrollFromCsv(batchId: string, user: JwtPayload, buffer: Buffer) {
    const batch = await this.requireBatchWithCourse(batchId);
    this.assertOwnership(user, batch.course.facultyId);

    const text = buffer.toString('utf-8');
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    const emails = parsed.data.map((row) => (row.email ?? row.Email ?? '').trim().toLowerCase()).filter(Boolean);
    if (emails.length === 0) {
      throw new BadRequestException('CSV did not contain an "email" column with any values');
    }

    const validStudents = await this.prisma.user.findMany({
      where: { email: { in: emails }, role: 'STUDENT' },
      select: { id: true },
    });
    if (validStudents.length === 0) {
      throw new BadRequestException('None of the emails in the CSV matched a student account');
    }

    const newIds = await this.diffNewEnrollments(batchId, validStudents.map((s) => s.id));
    const { bulkOperationId } = await this.insertEnrollmentsAndRecord(batchId, user, newIds);
    return { enrolled: newIds.length, skipped: validStudents.length - newIds.length, bulkOperationId };
  }

  async unenrollStudent(batchId: string, user: JwtPayload, studentId: string) {
    const batch = await this.requireBatchWithCourse(batchId);
    this.assertOwnership(user, batch.course.facultyId);
    const enrollment = await this.prisma.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId, studentId } },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    await this.prisma.batchEnrollment.delete({ where: { id: enrollment.id } });
    return { success: true };
  }

  private async diffNewEnrollments(batchId: string, candidateIds: string[]): Promise<string[]> {
    const existing = await this.prisma.batchEnrollment.findMany({
      where: { batchId, studentId: { in: candidateIds } },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map((e) => e.studentId));
    return candidateIds.filter((id) => !existingIds.has(id));
  }

  private async insertEnrollmentsAndRecord(
    batchId: string,
    user: JwtPayload,
    newIds: string[],
  ): Promise<{ bulkOperationId?: string }> {
    if (newIds.length === 0) {
      return { bulkOperationId: undefined };
    }
    await this.prisma.batchEnrollment.createMany({
      data: newIds.map((studentId) => ({ batchId, studentId })),
    });
    const op = await this.bulkOperations.recordBatchEnroll(user, batchId, newIds);
    return { bulkOperationId: op?.id };
  }

  private async requireDefaultStatus() {
    const status = await this.prisma.batchStatusType.findFirst({ where: { isDefault: true } });
    if (!status) throw new BadRequestException('No default batch status is configured');
    return status;
  }

  private assertOwnership(user: JwtPayload, facultyId: string) {
    if (!isOwnerOrAdmin(user, facultyId)) {
      throw new ForbiddenException('You do not own this batch');
    }
  }

  private async requireCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async requireBatchWithCourse(id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id }, include: { course: true } });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }
}
