import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { ChaptersController } from './chapters.controller';
import { LessonsController } from './lessons.controller';
import { EnrollmentsController } from './enrollments.controller';
import { FlashcardsController } from './flashcards.controller';
import { NotesController } from './notes.controller';
import { UploadsModule } from '../uploads/uploads.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [UploadsModule, AiModule],
  controllers: [
    CoursesController,
    ChaptersController,
    LessonsController,
    EnrollmentsController,
    FlashcardsController,
    NotesController,
  ],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
