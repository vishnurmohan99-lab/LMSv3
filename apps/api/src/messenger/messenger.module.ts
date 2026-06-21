import { Module } from '@nestjs/common';
import { MessengerService } from './messenger.service';
import { MessengerController } from './messenger.controller';
import { MessengerSchedulerService } from './messenger-scheduler.service';

@Module({
  controllers: [MessengerController],
  providers: [MessengerService, MessengerSchedulerService],
  exports: [MessengerService],
})
export class MessengerModule {}
