import { Module } from '@nestjs/common';
import { BatchStatusTypesService } from './batch-status-types.service';
import { BatchStatusTypesController } from './batch-status-types.controller';

@Module({
  controllers: [BatchStatusTypesController],
  providers: [BatchStatusTypesService],
  exports: [BatchStatusTypesService],
})
export class BatchStatusTypesModule {}
