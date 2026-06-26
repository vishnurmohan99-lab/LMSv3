import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AnswerSubmissionsService } from './answer-submissions.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateAnswerSubmissionDto } from './dto/create-answer-submission.dto';
import { GradeAnswerSubmissionDto } from './dto/grade-answer-submission.dto';

@UseGuards(JwtAccessGuard)
@Controller('answer-submissions')
export class AnswerSubmissionsController {
  constructor(private readonly submissions: AnswerSubmissionsService) {}

  @Post()
  create(@Body() dto: CreateAnswerSubmissionDto, @CurrentUser() user: JwtPayload) {
    return this.submissions.createAndGrade(user, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: JwtPayload) {
    return this.submissions.listMine(user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Get()
  list(@Query('questionId') questionId: string | undefined) {
    return this.submissions.listAll(questionId);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.submissions.getById(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Patch(':id/grade')
  grade(@Param('id') id: string, @Body() dto: GradeAnswerSubmissionDto, @CurrentUser() user: JwtPayload) {
    return this.submissions.gradeManually(id, user, dto);
  }
}
