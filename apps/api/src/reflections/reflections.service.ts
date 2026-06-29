import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { UpsertReflectionDto } from './dto/upsert-reflection.dto';

/** Normalizes any incoming date(time) string to a UTC midnight Date, so the
 *  (studentId, date) unique constraint reliably means "one reflection per day"
 *  regardless of what time-of-day the client happened to send. */
function dayOnly(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class ReflectionsService {
  constructor(private readonly prisma: PrismaService) {}

  upsertMine(user: JwtPayload, dto: UpsertReflectionDto) {
    const date = dayOnly(dto.date);
    return this.prisma.reflection.upsert({
      where: { studentId_date: { studentId: user.sub, date } },
      create: { studentId: user.sub, date, wentWell: dto.wentWell, toImprove: dto.toImprove },
      update: { wentWell: dto.wentWell, toImprove: dto.toImprove },
    });
  }

  listMine(user: JwtPayload, days = 30) {
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - days);
    return this.prisma.reflection.findMany({
      where: { studentId: user.sub, date: { gte: dayOnly(from.toISOString()) } },
      orderBy: { date: 'desc' },
    });
  }

  listAllForAdmin(studentId?: string) {
    return this.prisma.reflection.findMany({
      where: studentId ? { studentId } : undefined,
      include: { student: { select: { id: true, fullName: true, email: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    });
  }
}
