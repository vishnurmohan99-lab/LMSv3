import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatchStatusTypeDto } from './dto/create-batch-status-type.dto';
import { UpdateBatchStatusTypeDto } from './dto/update-batch-status-type.dto';
import { withUniqueNameCheck } from '../common/unique-violation';

@Injectable()
export class BatchStatusTypesService {
  constructor(private readonly prisma: PrismaService) {}

  listBatchStatusTypes() {
    return this.prisma.batchStatusType.findMany({ orderBy: { order: 'asc' } });
  }

  async createBatchStatusType(dto: CreateBatchStatusTypeDto) {
    return withUniqueNameCheck(
      () =>
        this.prisma.$transaction(
          async (tx) => {
            if (dto.isDefault) {
              await tx.batchStatusType.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
            }
            if (dto.isCompletionTarget) {
              await tx.batchStatusType.updateMany({ where: { isCompletionTarget: true }, data: { isCompletionTarget: false } });
            }
            return tx.batchStatusType.create({
              data: {
                name: dto.name,
                color: dto.color,
                order: dto.order ?? 0,
                isDefault: dto.isDefault ?? false,
                isCompletionTarget: dto.isCompletionTarget ?? false,
              },
            });
          },
          { maxWait: 15000, timeout: 15000 },
        ),
      'status',
    );
  }

  async updateBatchStatusType(id: string, dto: UpdateBatchStatusTypeDto) {
    await this.requireBatchStatusType(id);
    return withUniqueNameCheck(
      () =>
        this.prisma.$transaction(
          async (tx) => {
            if (dto.isDefault) {
              await tx.batchStatusType.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
            }
            if (dto.isCompletionTarget) {
              await tx.batchStatusType.updateMany({
                where: { isCompletionTarget: true, id: { not: id } },
                data: { isCompletionTarget: false },
              });
            }
            return tx.batchStatusType.update({ where: { id }, data: dto });
          },
          { maxWait: 15000, timeout: 15000 },
        ),
      'status',
    );
  }

  async deleteBatchStatusType(id: string) {
    await this.requireBatchStatusType(id);
    const inUse = await this.prisma.batch.count({ where: { statusId: id } });
    if (inUse > 0) {
      throw new BadRequestException(`This status is in use by ${inUse} batch${inUse === 1 ? '' : 'es'}`);
    }
    await this.prisma.batchStatusType.delete({ where: { id } });
    return { success: true };
  }

  private async requireBatchStatusType(id: string) {
    const status = await this.prisma.batchStatusType.findUnique({ where: { id } });
    if (!status) throw new NotFoundException('Batch status not found');
    return status;
  }
}
