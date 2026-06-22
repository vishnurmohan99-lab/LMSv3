import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TestAttemptsService } from './test-attempts.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { SaveAnswerDto } from './dto/save-answer.dto';

@UseGuards(JwtAccessGuard)
@Controller()
export class TestAttemptsController {
  constructor(private readonly attempts: TestAttemptsService) {}

  @Post('tests/:id/attempts')
  start(@Param('id') testId: string, @CurrentUser() user: JwtPayload) {
    return this.attempts.startAttempt(user, testId);
  }

  @Get('tests/:id/attempts/mine')
  mine(@Param('id') testId: string, @CurrentUser() user: JwtPayload) {
    return this.attempts.listMine(user, testId);
  }

  @Get('tests/:id/leaderboard')
  leaderboard(@Param('id') testId: string, @CurrentUser() user: JwtPayload) {
    return this.attempts.getLeaderboard(user, testId);
  }

  @Patch('attempts/:id/answers')
  saveAnswer(@Param('id') attemptId: string, @Body() dto: SaveAnswerDto, @CurrentUser() user: JwtPayload) {
    return this.attempts.saveAnswer(user, attemptId, dto);
  }

  @Post('attempts/:id/submit')
  submit(@Param('id') attemptId: string, @CurrentUser() user: JwtPayload) {
    return this.attempts.submitAttempt(user, attemptId);
  }
}
