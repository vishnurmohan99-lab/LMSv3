import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { SetMentorDto } from './dto/set-mentor.dto';
import { withUniqueNameCheck } from '../common/unique-violation';

const SAFE_MENTOR_SELECT = {
  id: true,
  fullName: true,
  email: true,
  mentorSpecialty: true,
};

@Injectable()
export class MentorService {
  constructor(private readonly prisma: PrismaService) {}

  listMentors() {
    return this.prisma.user.findMany({
      where: { isMentor: true },
      select: SAFE_MENTOR_SELECT,
      orderBy: { fullName: 'asc' },
    });
  }

  async setMentorFlag(facultyId: string, dto: SetMentorDto) {
    const user = await this.prisma.user.findUnique({ where: { id: facultyId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'FACULTY') throw new BadRequestException('Only faculty members can be marked as mentors');
    return this.prisma.user.update({
      where: { id: facultyId },
      data: { isMentor: dto.isMentor, mentorSpecialty: dto.isMentor ? dto.specialty ?? user.mentorSpecialty : null },
      select: SAFE_MENTOR_SELECT,
    });
  }

  async listOwnAvailability(mentor: JwtPayload) {
    return this.prisma.mentorAvailability.findMany({
      where: { mentorId: mentor.sub },
      orderBy: [{ dayOfWeek: 'asc' }, { time: 'asc' }],
    });
  }

  async addAvailability(mentor: JwtPayload, dto: CreateAvailabilityDto) {
    await this.assertIsMentor(mentor.sub);
    return withUniqueNameCheck(
      () =>
        this.prisma.mentorAvailability.create({
          data: { mentorId: mentor.sub, dayOfWeek: dto.dayOfWeek, time: dto.time },
        }),
      'availability slot',
    );
  }

  async removeAvailability(mentor: JwtPayload, id: string) {
    const slot = await this.prisma.mentorAvailability.findUnique({ where: { id } });
    if (!slot) throw new NotFoundException('Availability slot not found');
    if (slot.mentorId !== mentor.sub) throw new ForbiddenException('You do not own this availability slot');
    await this.prisma.mentorAvailability.delete({ where: { id } });
    return { success: true };
  }

  private async assertIsMentor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isMentor) throw new ForbiddenException('You are not enabled as a mentor');
  }

  async getMentorSlots(mentorId: string, days = 7) {
    const mentor = await this.prisma.user.findUnique({ where: { id: mentorId } });
    if (!mentor?.isMentor) throw new NotFoundException('Mentor not found');

    const availability = await this.prisma.mentorAvailability.findMany({ where: { mentorId } });
    if (availability.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingDates: Date[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      upcomingDates.push(d);
    }

    const bookings = await this.prisma.mentorBooking.findMany({
      where: { mentorId, cancelledAt: null, date: { gte: today } },
    });
    const bookedKey = new Set(bookings.map((b) => `${b.availabilityId}_${b.date.toISOString()}`));

    const slots: { availabilityId: string; date: string; time: string; dayOfWeek: number; booked: boolean }[] = [];
    for (const date of upcomingDates) {
      const dayOfWeek = date.getDay();
      for (const slot of availability.filter((a) => a.dayOfWeek === dayOfWeek)) {
        slots.push({
          availabilityId: slot.id,
          date: date.toISOString(),
          time: slot.time,
          dayOfWeek,
          booked: bookedKey.has(`${slot.id}_${date.toISOString()}`),
        });
      }
    }
    return slots.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }

  async createBooking(student: JwtPayload, mentorId: string, dto: CreateBookingDto) {
    const availability = await this.prisma.mentorAvailability.findUnique({ where: { id: dto.availabilityId } });
    if (!availability || availability.mentorId !== mentorId) {
      throw new NotFoundException('Availability slot not found for this mentor');
    }

    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);
    if (date.getDay() !== availability.dayOfWeek) {
      throw new BadRequestException('Selected date does not match the availability slot day');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) throw new BadRequestException('Cannot book a date in the past');

    return withUniqueNameCheck(
      () =>
        this.prisma.mentorBooking.create({
          data: { availabilityId: availability.id, mentorId, studentId: student.sub, date },
          include: { mentor: { select: SAFE_MENTOR_SELECT } },
        }),
      'booking for this slot',
    );
  }

  listMyBookingsAsStudent(student: JwtPayload) {
    return this.prisma.mentorBooking.findMany({
      where: { studentId: student.sub, cancelledAt: null },
      include: { mentor: { select: SAFE_MENTOR_SELECT }, availability: true },
      orderBy: { date: 'asc' },
    });
  }

  listMyBookingsAsMentor(mentor: JwtPayload) {
    return this.prisma.mentorBooking.findMany({
      where: { mentorId: mentor.sub, cancelledAt: null },
      include: { student: { select: { id: true, fullName: true, email: true } }, availability: true },
      orderBy: { date: 'asc' },
    });
  }

  async cancelBooking(user: JwtPayload, id: string) {
    const booking = await this.prisma.mentorBooking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    const isOwner = booking.studentId === user.sub || booking.mentorId === user.sub;
    if (!isOwner && user.role !== 'ADMIN') throw new ForbiddenException('You do not have access to this booking');
    return this.prisma.mentorBooking.update({ where: { id }, data: { cancelledAt: new Date() } });
  }
}
