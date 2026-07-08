import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreatePlanItemDto } from './dto/create-plan-item.dto';
import { UpdatePlanItemDto } from './dto/update-plan-item.dto';

@Injectable()
export class StudyPlanService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Batch plan (FACULTY/ADMIN) ----
  private async requireBatchAccess(batchId: string, user: JwtPayload) {
    const batch = await this.prisma.batch.findUnique({ where: { id: batchId }, select: { id: true, facultyId: true } });
    if (!batch) throw new NotFoundException('Batch not found');
    if (user.role !== 'ADMIN' && batch.facultyId !== user.sub) {
      throw new ForbiddenException('You do not manage this batch');
    }
    return batch;
  }

  async listBatchPlan(batchId: string, user: JwtPayload) {
    await this.requireBatchAccess(batchId, user);
    return this.prisma.studyPlanItem.findMany({ where: { batchId }, orderBy: { scheduledFor: 'asc' } });
  }

  async createBatchItem(batchId: string, user: JwtPayload, dto: CreatePlanItemDto) {
    await this.requireBatchAccess(batchId, user);
    return this.prisma.studyPlanItem.create({
      data: {
        batchId,
        createdById: user.sub,
        scheduledFor: new Date(dto.scheduledFor),
        type: dto.type ?? 'OTHER',
        title: dto.title,
        resourceKind: dto.resourceKind ?? null,
        resourceId: dto.resourceId ?? null,
        courseId: dto.courseId ?? null,
      },
    });
  }

  // ---- Student: merged plan (batch items for my batches + my own personal items) ----
  async listMyPlan(user: JwtPayload, from?: string, to?: string) {
    const myBatches = await this.prisma.batchEnrollment.findMany({ where: { studentId: user.sub }, select: { batchId: true } });
    const batchIds = myBatches.map((b) => b.batchId);
    const dateFilter = from || to ? { scheduledFor: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {};
    const items = await this.prisma.studyPlanItem.findMany({
      where: { OR: [{ batchId: { in: batchIds } }, { studentId: user.sub }], ...dateFilter },
      orderBy: { scheduledFor: 'asc' },
      include: { batch: { select: { id: true, name: true } } },
    });
    return items.map((i) => ({ ...i, source: i.studentId === user.sub ? 'personal' : 'batch' }));
  }

  async createMyItem(user: JwtPayload, dto: CreatePlanItemDto) {
    return this.prisma.studyPlanItem.create({
      data: {
        studentId: user.sub,
        createdById: user.sub,
        scheduledFor: new Date(dto.scheduledFor),
        type: dto.type ?? 'OTHER',
        title: dto.title,
        resourceKind: dto.resourceKind ?? null,
        resourceId: dto.resourceId ?? null,
        courseId: dto.courseId ?? null,
      },
    });
  }

  // ---- Update / delete (owner-checked) ----
  private async requireItemAccess(id: string, user: JwtPayload) {
    const item = await this.prisma.studyPlanItem.findUnique({
      where: { id },
      include: { batch: { select: { facultyId: true } } },
    });
    if (!item) throw new NotFoundException('Plan item not found');
    if (item.studentId) {
      // personal item: owner student or admin
      if (user.role !== 'ADMIN' && item.studentId !== user.sub) throw new ForbiddenException('Not your plan item');
    } else {
      // batch item: admin or the batch's faculty
      if (user.role !== 'ADMIN' && item.batch?.facultyId !== user.sub) throw new ForbiddenException('You do not manage this batch');
    }
    return item;
  }

  async updateItem(id: string, user: JwtPayload, dto: UpdatePlanItemDto) {
    await this.requireItemAccess(id, user);
    return this.prisma.studyPlanItem.update({
      where: { id },
      data: {
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
        type: dto.type,
        title: dto.title,
        resourceKind: dto.resourceKind === undefined ? undefined : dto.resourceKind,
        resourceId: dto.resourceId === undefined ? undefined : dto.resourceId,
        courseId: dto.courseId === undefined ? undefined : dto.courseId,
      },
    });
  }

  async deleteItem(id: string, user: JwtPayload) {
    await this.requireItemAccess(id, user);
    await this.prisma.studyPlanItem.delete({ where: { id } });
    return { success: true };
  }
}
