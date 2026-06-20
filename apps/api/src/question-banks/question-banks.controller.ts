import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { QuestionBanksService } from './question-banks.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import { UpdateQuestionBankDto } from './dto/update-question-bank.dto';
import { CreateQuestionDto } from './dto/create-question.dto';

@UseGuards(JwtAccessGuard)
@Controller('question-banks')
export class QuestionBanksController {
  constructor(private readonly questionBanksService: QuestionBanksService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.questionBanksService.listQuestionBanks(user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.questionBanksService.getQuestionBank(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post()
  create(@Body() dto: CreateQuestionBankDto, @CurrentUser() user: JwtPayload) {
    return this.questionBanksService.createQuestionBank(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuestionBankDto, @CurrentUser() user: JwtPayload) {
    return this.questionBanksService.updateQuestionBank(id, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.questionBanksService.deleteQuestionBank(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post(':id/questions')
  createQuestion(@Param('id') id: string, @Body() dto: CreateQuestionDto, @CurrentUser() user: JwtPayload) {
    return this.questionBanksService.createQuestion(id, user, dto);
  }
}
