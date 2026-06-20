import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TestsService } from './tests.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { CreateTestQuestionDto } from './dto/create-test-question.dto';
import { ImportQuestionsDto } from './dto/import-questions.dto';

@UseGuards(JwtAccessGuard)
@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.testsService.listTests(user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.testsService.getTest(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post()
  create(@Body() dto: CreateTestDto, @CurrentUser() user: JwtPayload) {
    return this.testsService.createTest(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTestDto, @CurrentUser() user: JwtPayload) {
    return this.testsService.updateTest(id, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.testsService.deleteTest(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post(':id/questions')
  createQuestion(@Param('id') id: string, @Body() dto: CreateTestQuestionDto, @CurrentUser() user: JwtPayload) {
    return this.testsService.createQuestion(id, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post(':id/import-questions')
  importQuestions(@Param('id') id: string, @Body() dto: ImportQuestionsDto, @CurrentUser() user: JwtPayload) {
    return this.testsService.importQuestions(id, user, dto);
  }
}
