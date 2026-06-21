import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { BulkOperationType } from '../../generated/prisma/client';

function isOwnerOrAdmin(user: JwtPayload, createdBy: string) {
  return user.role === 'ADMIN' || user.sub === createdBy;
}

@Injectable()
export class BulkOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordBatchEnroll(user: JwtPayload, batchId: string, studentIds: string[]) {
    if (studentIds.length === 0) return null;
    return this.prisma.bulkOperation.create({
      data: {
        type: BulkOperationType.BATCH_ENROLL,
        payload: { batchId, studentIds },
        createdBy: user.sub,
      },
    });
  }

  async listForBatch(batchId: string, user: JwtPayload) {
    return this.prisma.bulkOperation.findMany({
      where: {
        type: BulkOperationType.BATCH_ENROLL,
        createdBy: user.role === 'ADMIN' ? undefined : user.sub,
        payload: { path: ['batchId'], equals: batchId },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async undo(id: string, user: JwtPayload) {
    const op = await this.prisma.bulkOperation.findUnique({ where: { id } });
    if (!op) throw new NotFoundException('Operation not found');
    if (!isOwnerOrAdmin(user, op.createdBy)) {
      throw new ForbiddenException('You do not own this operation');
    }
    if (op.undoneAt) {
      throw new BadRequestException('This operation has already been undone');
    }

    if (op.type === BulkOperationType.BATCH_ENROLL) {
      const payload = op.payload as { batchId: string; studentIds: string[] };
      await this.prisma.batchEnrollment.deleteMany({
        where: { batchId: payload.batchId, studentId: { in: payload.studentIds } },
      });
    }

    return this.prisma.bulkOperation.update({ where: { id }, data: { undoneAt: new Date() } });
  }
}
