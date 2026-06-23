import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('FACULTY', 'ADMIN')
@Controller()
export class ChaptersController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post('courses/:courseId/chapters')
  create(@Param('courseId') courseId: string, @Body() dto: CreateChapterDto, @CurrentUser() user: JwtPayload) {
    return this.coursesService.createChapter(courseId, user, dto);
  }

  @Patch('chapters/:id')
  update(@Param('id') id: string, @Body() dto: UpdateChapterDto, @CurrentUser() user: JwtPayload) {
    return this.coursesService.updateChapter(id, user, dto);
  }

  @Delete('chapters/:id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.deleteChapter(id, user);
  }

  @Roles('STUDENT')
  @Post('chapters/:id/complete')
  markComplete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.markChapterComplete(id, user);
  }
}
