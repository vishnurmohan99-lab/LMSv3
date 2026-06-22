import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import Papa from 'papaparse';
import { PrismaService } from '../prisma/prisma.service';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { withUniqueNameCheck } from '../common/unique-violation';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bulkOperations: BulkOperationsService,
  ) {}

  listAllBatches(segmentId?: string, subsegmentId?: string) {
    return this.prisma.batch.findMany({
      where: { ...(segmentId && { segmentId }), ...(subsegmentId && { subsegmentId }) },
      orderBy: { createdAt: 'desc' },
      include: {
        segment: { select: { id: true, name: true } },
        subsegment: { select: { id: true, name: true } },
        faculty: { select: { id: true, fullName: true } },
        status: true,
        _count: { select: { enrollments: true } },
      },
    });
  }

  listBatchesForFaculty(facultyId: string) {
    return this.prisma.batch.findMany({
      where: { facultyId },
      orderBy: { createdAt: 'desc' },
      include: {
        segment: { select: { id: true, name: true } },
        subsegment: { select: { id: true, name: true } },
        status: true,
        _count: { select: { enrollments: true } },
      },
    });
  }

  async getBatch(id: string, user: JwtPayload) {
    const batch = await this.requireBatch(id);
    if (user.role !== 'ADMIN' && batch.facultyId !== user.sub) {
      throw new ForbiddenException('You are not assigned to this batch');
    }
    return this.prisma.batch.findUnique({
      where: { id },
      include: {
        segment: { select: { id: true, name: true } },
        subsegment: { select: { id: true, name: true } },
        status: true,
        faculty: { select: { id: true, fullName: true } },
        enrollments: { include: { student: { select: { id: true, fullName: true, email: true } } } },
        sessions: { orderBy: { scheduledAt: 'asc' } },
        _count: { select: { enrollments: true, sessions: true } },
      },
    });
  }

  async createBatch(dto: CreateBatchDto) {
    if (!dto.segmentId && !dto.subsegmentId) {
      throw new BadRequestException('A batch must be created under a segment or subsegment');
    }
    if (dto.segmentId && dto.subsegmentId) {
      throw new BadRequestException('A batch can only belong to one of segment or subsegment, not both');
    }
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
            segmentId: dto.segmentId,
            subsegmentId: dto.subsegmentId,
          },
        }),
      'batch',
    );
  }

  async updateBatch(id: string, dto: UpdateBatchDto) {
    await this.requireBatch(id);
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

  async deleteBatch(id: string) {
    await this.requireBatch(id);
    await this.prisma.batch.delete({ where: { id } });
    return { success: true };
  }

  async extendBatch(id: string, newEndDate: string) {
    await this.requireBatch(id);
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

  async getStats() {
    const batches = await this.prisma.batch.findMany({
      include: {
        status: { select: { id: true, name: true } },
        segment: { select: { id: true, name: true } },
        subsegment: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
    });

    const byStatus = new Map<string, { statusId: string; name: string; count: number }>();
    const bySegment = new Map<string, { label: string; byStatus: Map<string, { statusId: string; name: string; count: number }> }>();

    for (const batch of batches) {
      const statusEntry = byStatus.get(batch.statusId) ?? { statusId: batch.statusId, name: batch.status.name, count: 0 };
      statusEntry.count++;
      byStatus.set(batch.statusId, statusEntry);

      const scopeKey = batch.segmentId ?? batch.subsegmentId ?? 'unscoped';
      const scopeLabel = batch.segment?.name ?? batch.subsegment?.name ?? 'Unscoped';
      const scopeEntry = bySegment.get(scopeKey) ?? { label: scopeLabel, byStatus: new Map() };
      const scopeStatusEntry = scopeEntry.byStatus.get(batch.statusId) ?? { statusId: batch.statusId, name: batch.status.name, count: 0 };
      scopeStatusEntry.count++;
      scopeEntry.byStatus.set(batch.statusId, scopeStatusEntry);
      bySegment.set(scopeKey, scopeEntry);
    }

    return {
      totalBatches: batches.length,
      totalLearners: batches.reduce((sum, b) => sum + b._count.enrollments, 0),
      byStatus: [...byStatus.values()],
      bySegment: [...bySegment.entries()].map(([id, c]) => ({ id, label: c.label, byStatus: [...c.byStatus.values()] })),
    };
  }

  private async syncCourseEnrollments(studentId: string, batch: { segmentId: string | null; subsegmentId: string | null }) {
    if (!batch.segmentId && !batch.subsegmentId) return;
    const courses = await this.prisma.course.findMany({
      where: { OR: [...(batch.segmentId ? [{ segmentId: batch.segmentId }] : []), ...(batch.subsegmentId ? [{ subsegmentId: batch.subsegmentId }] : [])] },
      select: { id: true },
    });
    if (courses.length === 0) return;
    await this.prisma.enrollment.createMany({
      data: courses.map((c) => ({ studentId, courseId: c.id, source: 'BATCH' as const })),
      skipDuplicates: true,
    });
  }

  async enrollStudent(batchId: string, studentId: string) {
    const batch = await this.requireBatch(batchId);
    try {
      const enrollment = await this.prisma.batchEnrollment.create({ data: { batchId, studentId } });
      await this.syncCourseEnrollments(studentId, batch);
      return enrollment;
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
    const batch = await this.requireBatch(batchId);

    const validStudents = await this.prisma.user.findMany({
      where: { id: { in: studentIds }, role: 'STUDENT' },
      select: { id: true },
    });
    if (validStudents.length === 0) {
      throw new BadRequestException('None of the provided student IDs are valid students');
    }

    const newIds = await this.diffNewEnrollments(batchId, validStudents.map((s) => s.id));
    const { bulkOperationId } = await this.insertEnrollmentsAndRecord(batchId, user, newIds);
    for (const studentId of newIds) await this.syncCourseEnrollments(studentId, batch);
    return { enrolled: newIds.length, skipped: validStudents.length - newIds.length, bulkOperationId };
  }

  async enrollFromCsv(batchId: string, user: JwtPayload, buffer: Buffer) {
    const batch = await this.requireBatch(batchId);

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
    for (const studentId of newIds) await this.syncCourseEnrollments(studentId, batch);
    return { enrolled: newIds.length, skipped: validStudents.length - newIds.length, bulkOperationId };
  }

  async unenrollStudent(batchId: string, studentId: string) {
    await this.requireBatch(batchId);
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

  async requireBatch(id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }
}
