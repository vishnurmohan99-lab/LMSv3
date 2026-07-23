import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { withUniqueNameCheck } from '../common/unique-violation';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

const LIST_INCLUDE = {
  _count: { select: { courses: true, tests: true, enrollments: true } },
} as const;

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  listAll() {
    return this.prisma.subscription.findMany({ orderBy: { createdAt: 'desc' }, include: LIST_INCLUDE });
  }

  async listForStudent(studentId: string) {
    const subscriptions = await this.prisma.subscription.findMany({ orderBy: { createdAt: 'desc' }, include: LIST_INCLUDE });
    const mine = await this.prisma.subscriptionEnrollment.findMany({ where: { studentId }, select: { subscriptionId: true } });
    const mineIds = new Set(mine.map((m) => m.subscriptionId));
    return subscriptions.map((s) => ({ ...s, subscribed: mineIds.has(s.id) }));
  }

  listMine(studentId: string) {
    return this.prisma.subscriptionEnrollment.findMany({
      where: { studentId },
      include: { subscription: { include: LIST_INCLUDE } },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  async getDetail(id: string, user: JwtPayload) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        courses: { include: { course: { select: { id: true, title: true, type: true } } } },
        tests: { include: { test: { select: { id: true, title: true } } } },
        ...(user.role === 'ADMIN' ? { enrollments: { include: { student: { select: { id: true, fullName: true, email: true } } } } } : {}),
        _count: { select: { enrollments: true } },
      },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (user.role === 'STUDENT') {
      const mine = await this.prisma.subscriptionEnrollment.findUnique({
        where: { subscriptionId_studentId: { subscriptionId: id, studentId: user.sub } },
      });
      return { ...subscription, subscribed: !!mine };
    }
    return subscription;
  }

  create(dto: CreateSubscriptionDto) {
    return withUniqueNameCheck(
      () =>
        this.prisma.subscription.create({
          data: {
            title: dto.title.trim(),
            description: dto.description ?? '',
            priceCents: dto.priceCents ?? null,
            features: (dto.features ?? []).map((f) => f.trim()).filter(Boolean),
          },
        }),
      'subscription',
    );
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    await this.requireSubscription(id);
    // Spreading the dto straight in would write `undefined` keys as no-ops but also let a
    // stray key through; build the patch explicitly so only known fields are updated.
    const data: Parameters<typeof this.prisma.subscription.update>[0]['data'] = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priceCents !== undefined) data.priceCents = dto.priceCents;
    if (dto.features !== undefined) data.features = dto.features.map((f) => f.trim()).filter(Boolean);
    return withUniqueNameCheck(() => this.prisma.subscription.update({ where: { id }, data }), 'subscription');
  }

  async remove(id: string) {
    await this.requireSubscription(id);
    await this.prisma.subscription.delete({ where: { id } });
    return { success: true };
  }

  async addCourse(id: string, courseId: string) {
    await this.requireSubscription(id);
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new BadRequestException('Course not found');
    return this.prisma.subscriptionCourse.upsert({
      where: { subscriptionId_courseId: { subscriptionId: id, courseId } },
      create: { subscriptionId: id, courseId },
      update: {},
    });
  }

  async removeCourse(id: string, courseId: string) {
    await this.requireSubscription(id);
    await this.prisma.subscriptionCourse.deleteMany({ where: { subscriptionId: id, courseId } });
    return { success: true };
  }

  async addTest(id: string, testId: string) {
    await this.requireSubscription(id);
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new BadRequestException('Test not found');
    return this.prisma.subscriptionTest.upsert({
      where: { subscriptionId_testId: { subscriptionId: id, testId } },
      create: { subscriptionId: id, testId },
      update: {},
    });
  }

  async removeTest(id: string, testId: string) {
    await this.requireSubscription(id);
    await this.prisma.subscriptionTest.deleteMany({ where: { subscriptionId: id, testId } });
    return { success: true };
  }

  async enrollStudent(id: string, studentId: string) {
    const subscription = await this.requireSubscription(id);
    const enrollment = await this.prisma.subscriptionEnrollment.upsert({
      where: { subscriptionId_studentId: { subscriptionId: id, studentId } },
      create: { subscriptionId: id, studentId },
      update: {},
    });
    const courses = await this.prisma.subscriptionCourse.findMany({ where: { subscriptionId: id }, select: { courseId: true } });
    if (courses.length > 0) {
      await this.prisma.enrollment.createMany({
        data: courses.map((c) => ({ studentId, courseId: c.courseId, source: 'SUBSCRIPTION' as const })),
        skipDuplicates: true,
      });
    }
    return { ...enrollment, subscription };
  }

  async unenrollStudent(id: string, studentId: string) {
    await this.requireSubscription(id);
    await this.prisma.subscriptionEnrollment.deleteMany({ where: { subscriptionId: id, studentId } });
    return { success: true };
  }

  private async requireSubscription(id: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return subscription;
  }
}
