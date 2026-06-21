import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { MentorService } from './mentor.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { SetMentorDto } from './dto/set-mentor.dto';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

@UseGuards(JwtAccessGuard)
@Controller()
export class MentorController {
  constructor(private readonly mentor: MentorService) {}

  @Get('mentors')
  listMentors() {
    return this.mentor.listMentors();
  }

  @Get('mentors/:mentorId/slots')
  getMentorSlots(@Param('mentorId') mentorId: string, @Query('days') days?: string) {
    return this.mentor.getMentorSlots(mentorId, days ? Math.min(Math.max(parseInt(days, 10) || 7, 1), 30) : 7);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('users/:id/mentor')
  setMentorFlag(@Param('id') id: string, @Body() dto: SetMentorDto) {
    return this.mentor.setMentorFlag(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY')
  @Get('mentor/availability')
  listOwnAvailability(@CurrentUser() user: JwtPayload) {
    return this.mentor.listOwnAvailability(user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY')
  @Post('mentor/availability')
  addAvailability(@CurrentUser() user: JwtPayload, @Body() dto: CreateAvailabilityDto) {
    return this.mentor.addAvailability(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY')
  @Delete('mentor/availability/:id')
  removeAvailability(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.mentor.removeAvailability(user, id);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY')
  @Get('mentor/bookings/mine')
  listMyBookingsAsMentor(@CurrentUser() user: JwtPayload) {
    return this.mentor.listMyBookingsAsMentor(user);
  }

  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  @Post('mentors/:mentorId/bookings')
  createBooking(@CurrentUser() user: JwtPayload, @Param('mentorId') mentorId: string, @Body() dto: CreateBookingDto) {
    return this.mentor.createBooking(user, mentorId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  @Get('mentor/bookings/me')
  listMyBookingsAsStudent(@CurrentUser() user: JwtPayload) {
    return this.mentor.listMyBookingsAsStudent(user);
  }

  @Delete('mentor/bookings/:id')
  cancelBooking(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.mentor.cancelBooking(user, id);
  }
}
