import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Roles('ADMIN')
  @Get()
  listAll() {
    return this.subscriptions.listAll();
  }

  @Roles('STUDENT')
  @Get('available')
  listForStudent(@CurrentUser() user: JwtPayload) {
    return this.subscriptions.listForStudent(user.sub);
  }

  @Roles('STUDENT')
  @Get('me')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.subscriptions.listMine(user.sub);
  }

  @Get(':id')
  getDetail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.subscriptions.getDetail(id, user);
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptions.create(dto);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.subscriptions.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.subscriptions.remove(id);
  }

  @Roles('ADMIN')
  @Post(':id/courses/:courseId')
  addCourse(@Param('id') id: string, @Param('courseId') courseId: string) {
    return this.subscriptions.addCourse(id, courseId);
  }

  @Roles('ADMIN')
  @Delete(':id/courses/:courseId')
  removeCourse(@Param('id') id: string, @Param('courseId') courseId: string) {
    return this.subscriptions.removeCourse(id, courseId);
  }

  @Roles('ADMIN')
  @Post(':id/tests/:testId')
  addTest(@Param('id') id: string, @Param('testId') testId: string) {
    return this.subscriptions.addTest(id, testId);
  }

  @Roles('ADMIN')
  @Delete(':id/tests/:testId')
  removeTest(@Param('id') id: string, @Param('testId') testId: string) {
    return this.subscriptions.removeTest(id, testId);
  }

  @Roles('ADMIN')
  @Post(':id/enroll/:studentId')
  enrollStudent(@Param('id') id: string, @Param('studentId') studentId: string) {
    return this.subscriptions.enrollStudent(id, studentId);
  }

  @Roles('ADMIN')
  @Delete(':id/enroll/:studentId')
  unenrollStudent(@Param('id') id: string, @Param('studentId') studentId: string) {
    return this.subscriptions.unenrollStudent(id, studentId);
  }

  @Roles('STUDENT')
  @Post(':id/subscribe')
  subscribe(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.subscriptions.enrollStudent(id, user.sub);
  }
}
