import { Module } from '@nestjs/common';
import { TestAttemptsService } from './test-attempts.service';
import { TestAttemptsController } from './test-attempts.controller';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [TestAttemptsController],
  providers: [TestAttemptsService],
})
export class TestAttemptsModule {}
