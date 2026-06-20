import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../../generated/prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [totalUsers, usersByRoleRaw, totalCourses, publishedCourses, totalEnrollments, recentUsers] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
        this.prisma.course.count(),
        this.prisma.course.count({ where: { published: true } }),
        this.prisma.enrollment.count(),
        this.prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, fullName: true, email: true, role: true, createdAt: true },
        }),
      ]);

    const usersByRole: Record<Role, number> = { STUDENT: 0, FACULTY: 0, ADMIN: 0 };
    for (const row of usersByRoleRaw) {
      usersByRole[row.role] = row._count._all;
    }

    return {
      totalUsers,
      usersByRole,
      totalCourses,
      publishedCourses,
      totalEnrollments,
      recentUsers,
    };
  }
}
