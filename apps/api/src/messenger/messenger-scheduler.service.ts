import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MessengerService } from './messenger.service';

@Injectable()
export class MessengerSchedulerService {
  private readonly logger = new Logger(MessengerSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messenger: MessengerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDueScheduledMessages() {
    const due = await this.prisma.scheduledMessage.findMany({
      where: { sendAt: { lte: new Date() }, sentAt: null },
      include: { conversation: { include: { course: true, batch: { include: { course: true } } } } },
    });

    for (const scheduled of due) {
      const recipientIds = await this.messenger.resolveRecipients(scheduled.conversation, scheduled.senderId);
      await this.prisma.$transaction(
        async (tx) => {
          await tx.message.create({
            data: {
              conversationId: scheduled.conversationId,
              senderId: scheduled.senderId,
              body: scheduled.body,
              recipients: { create: recipientIds.map((userId) => ({ userId })) },
            },
          });
          await tx.scheduledMessage.update({ where: { id: scheduled.id }, data: { sentAt: new Date() } });
        },
        { maxWait: 15000, timeout: 15000 },
      );
    }

    if (due.length > 0) {
      this.logger.log(`Dispatched ${due.length} scheduled message(s)`);
    }
  }
}
