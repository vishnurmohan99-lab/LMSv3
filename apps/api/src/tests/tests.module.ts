import { Module } from '@nestjs/common';
import { TestsService } from './tests.service';
import { TestsController } from './tests.controller';
import { TestQuestionsController } from './test-questions.controller';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [TestsController, TestQuestionsController],
  providers: [TestsService],
  exports: [TestsService],
})
export class TestsModule {}
