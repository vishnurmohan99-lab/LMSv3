import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { ChaptersController } from './chapters.controller';
import { LessonsController } from './lessons.controller';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [CoursesController, ChaptersController, LessonsController],
  providers: [CoursesService],
})
export class CoursesModule {}
