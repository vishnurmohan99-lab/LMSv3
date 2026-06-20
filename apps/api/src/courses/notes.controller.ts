import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';

@UseGuards(JwtAccessGuard)
@Controller()
export class NotesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('lessons/:lessonId/notes')
  get(@Param('lessonId') lessonId: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.getNotes(lessonId, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post('lessons/:lessonId/notes/generate')
  generate(@Param('lessonId') lessonId: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.generateNotes(lessonId, user);
  }
}
