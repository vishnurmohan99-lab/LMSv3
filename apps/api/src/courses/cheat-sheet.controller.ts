import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { SetCheatSheetPosterDto } from './dto/set-cheat-sheet-poster.dto';

@UseGuards(JwtAccessGuard)
@Controller()
export class CheatSheetController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('lessons/:lessonId/cheat-sheet')
  get(@Param('lessonId') lessonId: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.getCheatSheet(lessonId, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post('lessons/:lessonId/cheat-sheet/generate')
  generate(@Param('lessonId') lessonId: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.generateCheatSheet(lessonId, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post('lessons/:lessonId/cheat-sheet/poster')
  setPoster(@Param('lessonId') lessonId: string, @Body() dto: SetCheatSheetPosterDto, @CurrentUser() user: JwtPayload) {
    return this.coursesService.setCheatSheetPoster(lessonId, user, dto.imageKey);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Delete('lessons/:lessonId/cheat-sheet/poster')
  removePoster(@Param('lessonId') lessonId: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.setCheatSheetPoster(lessonId, user, null);
  }
}
