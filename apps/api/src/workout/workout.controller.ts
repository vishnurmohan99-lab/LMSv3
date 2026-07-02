import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { WorkoutService } from './workout.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { QuestionType } from '../../generated/prisma/client';

const VALID_TYPES = new Set(Object.values(QuestionType));

@UseGuards(JwtAccessGuard)
@Controller('workout')
export class WorkoutController {
  constructor(private readonly workout: WorkoutService) {}

  @Get('courses/:courseId/questions')
  getQuestions(
    @Param('courseId') courseId: string,
    @Query('types') typesParam: string,
    @Query('count') countParam: string,
    @Query('comprehension') comprehensionParam: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const types = (typesParam ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => VALID_TYPES.has(t as QuestionType)) as QuestionType[];
    const includeComprehension = comprehensionParam === 'true' || comprehensionParam === '1';
    if (types.length === 0 && !includeComprehension) throw new BadRequestException('No valid question types specified');
    const count = Math.min(Math.max(parseInt(countParam, 10) || 10, 1), 50);
    return this.workout.getQuestions(user, courseId, types, count, includeComprehension);
  }
}
