import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  async listBatches(courseId: string, user: JwtPayload) {
    const course = await this.requireCourse(courseId);
    this.assertOwnership(user, course.facultyId);
    return this.prisma.batch.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { enrollments: true, sessions: true } } },
    });
  }

  async getBatch(id: string, user: JwtPayload) {
    const batch = await this.requireBatchWithCourse(id);
    this.assertOwnership(user, batch.course.facultyId);
    return this.prisma.batch.findUnique({
      where: { id },
      include: {
        enrollments: { include: { student: { select: { id: true, fullName: true, email: true } } } },
        sessions: { orderBy: { scheduledAt: 'asc' } },
        _count: { select: { enrollments: true, sessions: true } },
      },
    });
  }

  async createBatch(courseId: string, user: JwtPayload, dto: CreateBatchDto) {
    const course = await this.requireCourse(courseId);
    this.assertOwnership(user, course.facultyId);
    return withUniqueNameCheck(
      () =>
        this.prisma.batch.create({
          data: {
            name: dto.name,
            status: dto.status,
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

    const existingStudents = await this.prisma.user.findMany({
      where: { id: { in: studentIds }, role: 'STUDENT' },
      select: { id: true },
    });
    if (existingStudents.length === 0) {
      throw new BadRequestException('None of the provided student IDs are valid students');
    }

    const result = await this.prisma.batchEnrollment.createMany({
      data: existingStudents.map((s) => ({ batchId, studentId: s.id })),
      skipDuplicates: true,
    });
    return { enrolled: result.count };
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
