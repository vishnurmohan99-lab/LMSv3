import { Controller, Get, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';

@UseGuards(JwtAccessGuard, RolesGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Roles('STUDENT')
  @Get('student')
  getStudentCalendar(@CurrentUser() user: JwtPayload) {
    return this.calendar.getEventsForStudent(user);
  }

  @Roles('FACULTY')
  @Get('faculty')
  getFacultyCalendar(@CurrentUser() user: JwtPayload) {
    return this.calendar.getEventsForFaculty(user);
  }
}
