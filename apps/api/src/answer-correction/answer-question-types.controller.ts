import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AnswerCorrectionRubricService } from './answer-correction-rubric.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateAnswerQuestionTypeDto } from './dto/create-answer-question-type.dto';
import { UpdateAnswerQuestionTypeDto } from './dto/update-answer-question-type.dto';

@UseGuards(JwtAccessGuard)
@Controller('answer-question-types')
export class AnswerQuestionTypesController {
  constructor(private readonly rubric: AnswerCorrectionRubricService) {}

  @Get()
  list() {
    return this.rubric.listQuestionTypes();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.rubric.getQuestionType(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateAnswerQuestionTypeDto, @CurrentUser() user: JwtPayload) {
    return this.rubric.createQuestionType(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAnswerQuestionTypeDto) {
    return this.rubric.updateQuestionType(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rubric.deleteQuestionType(id);
  }
}
