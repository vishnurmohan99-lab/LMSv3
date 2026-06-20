import { Body, Controller, Delete, Param, Patch, UseGuards } from '@nestjs/common';
import { QuestionBanksService } from './question-banks.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { UpdateQuestionDto } from './dto/update-question.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('FACULTY', 'ADMIN')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionBanksService: QuestionBanksService) {}

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuestionDto, @CurrentUser() user: JwtPayload) {
    return this.questionBanksService.updateQuestion(id, user, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.questionBanksService.deleteQuestion(id, user);
  }
}
