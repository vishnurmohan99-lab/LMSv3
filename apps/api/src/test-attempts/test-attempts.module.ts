import { Module } from '@nestjs/common';
import { TestAttemptsService } from './test-attempts.service';
import { TestAttemptsController } from './test-attempts.controller';

@Module({
  controllers: [TestAttemptsController],
  providers: [TestAttemptsService],
})
export class TestAttemptsModule {}
