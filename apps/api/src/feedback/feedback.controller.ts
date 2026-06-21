import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateFeedbackFormDto } from './dto/create-feedback-form.dto';
import { SubmitFeedbackResponseDto } from './dto/submit-feedback-response.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Controller('feedback-forms')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Roles('ADMIN')
  @Post()
  create(@CurrentUser() admin: JwtPayload, @Body() dto: CreateFeedbackFormDto) {
    return this.feedback.createForm(admin, dto);
  }

  @Roles('ADMIN')
  @Get()
  list() {
    return this.feedback.listForms();
  }

  @Roles('ADMIN')
  @Get(':id/admin')
  getForAdmin(@Param('id') id: string) {
    return this.feedback.getFormForAdmin(id);
  }

  @Roles('STUDENT')
  @Get('me')
  listMine(@CurrentUser() student: JwtPayload) {
    return this.feedback.listMyForms(student);
  }

  @Roles('STUDENT')
  @Get(':id')
  getForFill(@Param('id') id: string, @CurrentUser() student: JwtPayload) {
    return this.feedback.getFormForFill(id, student);
  }

  @Roles('STUDENT')
  @Post(':id/responses')
  submit(@Param('id') id: string, @CurrentUser() student: JwtPayload, @Body() dto: SubmitFeedbackResponseDto) {
    return this.feedback.submitResponse(id, student, dto);
  }
}
