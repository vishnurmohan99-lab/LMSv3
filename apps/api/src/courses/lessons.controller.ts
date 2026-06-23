import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('FACULTY', 'ADMIN')
@Controller()
export class LessonsController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post('chapters/:chapterId/lessons')
  create(@Param('chapterId') chapterId: string, @Body() dto: CreateLessonDto, @CurrentUser() user: JwtPayload) {
    return this.coursesService.createLesson(chapterId, user, dto);
  }

  @Patch('lessons/:id')
  update(@Param('id') id: string, @Body() dto: UpdateLessonDto, @CurrentUser() user: JwtPayload) {
    return this.coursesService.updateLesson(id, user, dto);
  }

  @Delete('lessons/:id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.deleteLesson(id, user);
  }

  @Roles('STUDENT')
  @Post('lessons/:id/view')
  recordView(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.recordLessonView(id, user);
  }
}
