import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BatchesService } from '../batches/batches.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

function isOwnerOrAdmin(user: JwtPayload, facultyId: string | null) {
  return user.role === 'ADMIN' || (!!facultyId && user.sub === facultyId);
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batches: BatchesService,
  ) {}

  async listForBatch(batchId: string, user: JwtPayload) {
    const batch = await this.batches.requireBatch(batchId);
    await this.assertCanView(user, batch.facultyId, batchId);
    return this.prisma.session.findMany({ where: { batchId }, orderBy: { scheduledAt: 'asc' } });
  }

  async listSessions(user: JwtPayload, filters: { batchId?: string; from?: string; to?: string }) {
    const dateFilter = {
      ...(filters.from || filters.to
        ? {
            scheduledAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    if (user.role === 'ADMIN') {
      return this.prisma.session.findMany({
        where: { ...(filters.batchId ? { batchId: filters.batchId } : {}), ...dateFilter },
        orderBy: { scheduledAt: 'asc' },
      });
    }

    if (user.role === 'FACULTY') {
      return this.prisma.session.findMany({
        where: {
          ...(filters.batchId ? { batchId: filters.batchId } : {}),
          ...dateFilter,
          batch: { facultyId: user.sub },
        },
        orderBy: { scheduledAt: 'asc' },
      });
    }

    // STUDENT: only sessions for batches they're enrolled in
    return this.prisma.session.findMany({
      where: {
        ...(filters.batchId ? { batchId: filters.batchId } : {}),
        ...dateFilter,
        batch: { enrollments: { some: { studentId: user.sub } } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async createSession(batchId: string, user: JwtPayload, dto: CreateSessionDto) {
    const batch = await this.batches.requireBatch(batchId);
    this.assertOwnership(user, batch.facultyId);
    return this.prisma.session.create({
      data: {
        title: dto.title,
        scheduledAt: new Date(dto.scheduledAt),
        durationMin: dto.durationMin,
        status: dto.status,
        lessonId: dto.lessonId,
        batchId,
      },
    });
  }

  async updateSession(id: string, user: JwtPayload, dto: UpdateSessionDto) {
    const session = await this.requireSessionWithBatch(id);
    this.assertOwnership(user, session.batch.facultyId);
    return this.prisma.session.update({
      where: { id },
      data: {
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        actualStartAt: dto.actualStartAt ? new Date(dto.actualStartAt) : undefined,
        actualEndAt: dto.actualEndAt ? new Date(dto.actualEndAt) : undefined,
      },
    });
  }

  async deleteSession(id: string, user: JwtPayload) {
    const session = await this.requireSessionWithBatch(id);
    this.assertOwnership(user, session.batch.facultyId);
    await this.prisma.session.delete({ where: { id } });
    return { success: true };
  }

  private assertOwnership(user: JwtPayload, facultyId: string | null) {
    if (!isOwnerOrAdmin(user, facultyId)) {
      throw new ForbiddenException('You do not own this session');
    }
  }

  private async assertCanView(user: JwtPayload, facultyId: string | null, batchId: string) {
    if (isOwnerOrAdmin(user, facultyId)) return;
    const enrollment = await this.prisma.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId, studentId: user.sub } },
    });
    if (!enrollment) throw new ForbiddenException('You do not have access to this batch');
  }

  private async requireSessionWithBatch(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { batch: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }
}
