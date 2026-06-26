import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AnswerCorrectionRubricService } from './answer-correction-rubric.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateAnswerQuestionDto } from './dto/create-answer-question.dto';
import { UpdateAnswerQuestionDto } from './dto/update-answer-question.dto';

@UseGuards(JwtAccessGuard)
@Controller('answer-questions')
export class AnswerQuestionsController {
  constructor(private readonly rubric: AnswerCorrectionRubricService) {}

  @Get()
  list(@Query('published') published: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.rubric.listQuestions(user, published === 'true');
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.rubric.getQuestion(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateAnswerQuestionDto, @CurrentUser() user: JwtPayload) {
    return this.rubric.createQuestion(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAnswerQuestionDto) {
    return this.rubric.updateQuestion(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rubric.deleteQuestion(id);
  }
}
