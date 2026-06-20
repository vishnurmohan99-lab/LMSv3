import { Module } from '@nestjs/common';
import { SegmentsService } from './segments.service';
import { SegmentsController } from './segments.controller';
import { SubsegmentsController } from './subsegments.controller';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [SegmentsController, SubsegmentsController],
  providers: [SegmentsService],
  exports: [SegmentsService],
})
export class SegmentsModule {}
