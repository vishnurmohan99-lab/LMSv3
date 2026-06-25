import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';

@UseGuards(JwtAccessGuard)
@Controller()
export class SummaryDeckController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('lessons/:lessonId/summary-deck')
  get(@Param('lessonId') lessonId: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.getSummaryDeck(lessonId, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post('lessons/:lessonId/summary-deck/generate')
  generate(@Param('lessonId') lessonId: string, @Body() dto: { count?: number }, @CurrentUser() user: JwtPayload) {
    return this.coursesService.generateSummaryDeck(lessonId, user, dto.count);
  }
}
