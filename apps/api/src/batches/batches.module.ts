import { Module } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { BatchesController } from './batches.controller';
import { BatchStatusSchedulerService } from './batch-status-scheduler.service';
import { BulkOperationsModule } from '../bulk-operations/bulk-operations.module';

@Module({
  imports: [BulkOperationsModule],
  controllers: [BatchesController],
  providers: [BatchesService, BatchStatusSchedulerService],
  exports: [BatchesService],
})
export class BatchesModule {}
