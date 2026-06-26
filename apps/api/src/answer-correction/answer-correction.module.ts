import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { AiModule } from '../ai/ai.module';
import { AnswerCorrectionRubricService } from './answer-correction-rubric.service';
import { AnswerGradingService } from './answer-grading.service';
import { AnswerSubmissionsService } from './answer-submissions.service';
import { AnswerQuestionTypesController } from './answer-question-types.controller';
import { AnswerQuestionsController } from './answer-questions.controller';
import { AnswerSubmissionsController } from './answer-submissions.controller';

@Module({
  imports: [UploadsModule, AiModule],
  controllers: [AnswerQuestionTypesController, AnswerQuestionsController, AnswerSubmissionsController],
  providers: [AnswerCorrectionRubricService, AnswerGradingService, AnswerSubmissionsService],
})
export class AnswerCorrectionModule {}
