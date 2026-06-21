import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BatchStatusSchedulerService {
  private readonly logger = new Logger(BatchStatusSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async transitionEndedBatches() {
    const completionTarget = await this.prisma.batchStatusType.findFirst({ where: { isCompletionTarget: true } });
    if (!completionTarget) {
      this.logger.warn('No batch status is marked as the completion target — skipping auto-transition');
      return;
    }

    const result = await this.prisma.batch.updateMany({
      where: { endDate: { lt: new Date() }, statusId: { not: completionTarget.id } },
      data: { statusId: completionTarget.id },
    });

    if (result.count > 0) {
      this.logger.log(`Auto-transitioned ${result.count} batch(es) to "${completionTarget.name}"`);
    }
  }
}
