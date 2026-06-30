import { Controller, Get, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';

@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('STUDENT')
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('me')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.coursesService.listMyEnrollments(user);
  }

  @Get('me/activity')
  myActivity(@CurrentUser() user: JwtPayload) {
    return this.coursesService.getMyActivity(user);
  }
}
