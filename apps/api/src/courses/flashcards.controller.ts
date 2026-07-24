import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateFlashcardDto } from './dto/create-flashcard.dto';
import { UpdateFlashcardDto } from './dto/update-flashcard.dto';
import { FlashcardProgressDto } from './dto/flashcard-progress.dto';

@UseGuards(JwtAccessGuard)
@Controller()
export class FlashcardsController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('lessons/:lessonId/flashcards')
  list(@Param('lessonId') lessonId: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.listFlashcards(lessonId, user);
  }

  // Standalone spaced-repetition review hub (student-only). Cross-lesson, driven by dueAt.
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  @Get('flashcards/review/summary')
  reviewSummary(
    @CurrentUser() user: JwtPayload,
    @Query('courseId') courseId?: string,
    @Query('chapterId') chapterId?: string,
  ) {
    return this.coursesService.getFlashcardReviewSummary(user, { courseId, chapterId });
  }

  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  @Get('flashcards/review')
  review(
    @CurrentUser() user: JwtPayload,
    @Query('courseId') courseId?: string,
    @Query('chapterId') chapterId?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : undefined;
    return this.coursesService.getDueFlashcards(user, {
      courseId,
      chapterId,
      limit: parsed && Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined,
    });
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post('lessons/:lessonId/flashcards')
  create(@Param('lessonId') lessonId: string, @Body() dto: CreateFlashcardDto, @CurrentUser() user: JwtPayload) {
    return this.coursesService.createFlashcard(lessonId, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post('lessons/:lessonId/flashcards/generate')
  generate(@Param('lessonId') lessonId: string, @Body() dto: { count?: number }, @CurrentUser() user: JwtPayload) {
    return this.coursesService.generateFlashcards(lessonId, user, dto.count);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Patch('flashcards/:id')
  update(@Param('id') id: string, @Body() dto: UpdateFlashcardDto, @CurrentUser() user: JwtPayload) {
    return this.coursesService.updateFlashcard(id, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Delete('flashcards/:id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.deleteFlashcard(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  @Post('flashcards/:id/progress')
  setProgress(@Param('id') id: string, @Body() dto: FlashcardProgressDto, @CurrentUser() user: JwtPayload) {
    return this.coursesService.setFlashcardProgress(id, user, { grade: dto.grade, status: dto.status });
  }
}
