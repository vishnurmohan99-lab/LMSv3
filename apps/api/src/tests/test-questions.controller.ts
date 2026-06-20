import { Body, Controller, Delete, Param, Patch, UseGuards } from '@nestjs/common';
import { TestsService } from './tests.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { UpdateTestQuestionDto } from './dto/update-test-question.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('FACULTY', 'ADMIN')
@Controller('test-questions')
export class TestQuestionsController {
  constructor(private readonly testsService: TestsService) {}

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTestQuestionDto, @CurrentUser() user: JwtPayload) {
    return this.testsService.updateQuestion(id, user, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.testsService.deleteQuestion(id, user);
  }
}
