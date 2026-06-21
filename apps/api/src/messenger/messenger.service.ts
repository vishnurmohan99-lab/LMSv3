import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ScheduleMessageDto } from './dto/schedule-message.dto';
import { sanitizePrompt } from '../question-banks/sanitize-prompt';

function isOwnerOrAdmin(user: JwtPayload, facultyId: string) {
  return user.role === 'ADMIN' || user.sub === facultyId;
}

@Injectable()
export class MessengerService {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(user: JwtPayload, dto: CreateConversationDto) {
    if (dto.type === 'DIRECT') {
      if (!dto.userId) throw new BadRequestException('userId is required for a direct conversation');
      if (dto.userId === user.sub) throw new BadRequestException('Cannot start a conversation with yourself');

      const other = await this.prisma.user.findUnique({ where: { id: dto.userId } });
      if (!other) throw new NotFoundException('User not found');
      if (user.role === 'STUDENT' && other.role === 'STUDENT') {
        throw new ForbiddenException('Students cannot message other students directly');
      }

      const existing = await this.prisma.conversation.findFirst({
        where: {
          type: 'DIRECT',
          participants: { some: { userId: user.sub } },
          AND: { participants: { some: { userId: dto.userId } } },
        },
        include: { participants: true },
      });
      if (existing) return existing;

      return this.prisma.conversation.create({
        data: {
          type: 'DIRECT',
          createdById: user.sub,
          participants: { create: [{ userId: user.sub }, { userId: dto.userId }] },
        },
        include: { participants: true },
      });
    }

    if (dto.type === 'GROUP') {
      const participantIds = Array.from(new Set([user.sub, ...(dto.participantIds ?? [])]));
      if (participantIds.length < 2) throw new BadRequestException('A group needs at least one other participant');
      return this.prisma.conversation.create({
        data: {
          type: 'GROUP',
          createdById: user.sub,
          participants: { create: participantIds.map((userId) => ({ userId })) },
        },
        include: { participants: true },
      });
    }

    if (dto.type === 'COURSE_BROADCAST') {
      if (!dto.courseId) throw new BadRequestException('courseId is required for a course broadcast');
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course) throw new NotFoundException('Course not found');
      this.assertOwnership(user, course.facultyId);
      return this.prisma.conversation.create({
        data: { type: 'COURSE_BROADCAST', createdById: user.sub, courseId: dto.courseId },
      });
    }

    if (dto.type === 'BATCH_BROADCAST') {
      if (!dto.batchId) throw new BadRequestException('batchId is required for a batch broadcast');
      const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId }, include: { course: true } });
      if (!batch) throw new NotFoundException('Batch not found');
      this.assertOwnership(user, batch.course.facultyId);
      return this.prisma.conversation.create({
        data: { type: 'BATCH_BROADCAST', createdById: user.sub, batchId: dto.batchId },
      });
    }

    throw new BadRequestException('Unsupported conversation type');
  }

  /** Eligible direct-message contacts for the current user, scoped by role so students never see other students. */
  async listContacts(user: JwtPayload) {
    if (user.role === 'ADMIN') {
      return this.prisma.user.findMany({
        where: { id: { not: user.sub } },
        select: { id: true, fullName: true, email: true, role: true },
        orderBy: { fullName: 'asc' },
      });
    }

    if (user.role === 'STUDENT') {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { studentId: user.sub },
        select: { course: { select: { facultyId: true } } },
      });
      const facultyIds = Array.from(new Set(enrollments.map((e) => e.course.facultyId)));
      return this.prisma.user.findMany({
        where: { OR: [{ role: 'ADMIN' }, { id: { in: facultyIds } }] },
        select: { id: true, fullName: true, email: true, role: true },
        orderBy: { fullName: 'asc' },
      });
    }

    // FACULTY: admins + students enrolled in their own courses
    const enrollments = await this.prisma.enrollment.findMany({
      where: { course: { facultyId: user.sub } },
      select: { studentId: true },
    });
    const studentIds = Array.from(new Set(enrollments.map((e) => e.studentId)));
    return this.prisma.user.findMany({
      where: { OR: [{ role: 'ADMIN' }, { id: { in: studentIds } }] },
      select: { id: true, fullName: true, email: true, role: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async listConversations(user: JwtPayload) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [
          { participants: { some: { userId: user.sub } } },
          { course: { facultyId: user.sub } },
          { batch: { course: { facultyId: user.sub } } },
          ...(user.role === 'ADMIN'
            ? [{ type: { in: ['COURSE_BROADCAST', 'BATCH_BROADCAST'] as ('COURSE_BROADCAST' | 'BATCH_BROADCAST')[] } }]
            : []),
        ],
      },
      include: {
        participants: { include: { user: { select: { id: true, fullName: true, email: true, role: true } } } },
        course: { select: { id: true, title: true } },
        batch: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const unreadCounts = await this.prisma.messageRecipient.groupBy({
      by: ['messageId'],
      where: { userId: user.sub, readAt: null, message: { conversationId: { in: conversations.map((c) => c.id) } } },
    });
    const unreadByConversation = new Map<string, number>();
    if (unreadCounts.length > 0) {
      const rows = await this.prisma.messageRecipient.findMany({
        where: { userId: user.sub, readAt: null, message: { conversationId: { in: conversations.map((c) => c.id) } } },
        select: { message: { select: { conversationId: true } } },
      });
      for (const row of rows) {
        const key = row.message.conversationId;
        unreadByConversation.set(key, (unreadByConversation.get(key) ?? 0) + 1);
      }
    }

    return conversations.map((c) => ({
      ...c,
      lastMessage: c.messages[0] ?? null,
      unreadCount: unreadByConversation.get(c.id) ?? 0,
      messages: undefined,
    }));
  }

  async listMessages(user: JwtPayload, conversationId: string) {
    await this.requireParticipantAccess(user, conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, fullName: true, role: true } } },
    });
  }

  async sendMessage(user: JwtPayload, conversationId: string, dto: SendMessageDto) {
    const conversation = await this.requireParticipantAccess(user, conversationId);
    this.assertCanPost(conversation, user);
    const recipientIds = await this.resolveRecipients(conversation, user.sub);

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.sub,
        body: sanitizePrompt(dto.body),
        recipients: { create: recipientIds.map((userId) => ({ userId })) },
      },
      include: { sender: { select: { id: true, fullName: true, role: true } } },
    });
    return message;
  }

  async markRead(user: JwtPayload, conversationId: string) {
    await this.requireParticipantAccess(user, conversationId);
    await this.prisma.messageRecipient.updateMany({
      where: { userId: user.sub, readAt: null, message: { conversationId } },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async getUnreadCount(user: JwtPayload) {
    const count = await this.prisma.messageRecipient.count({ where: { userId: user.sub, readAt: null } });
    return { count };
  }

  async scheduleMessage(user: JwtPayload, dto: ScheduleMessageDto) {
    const conversation = await this.requireParticipantAccess(user, dto.conversationId);
    this.assertCanPost(conversation, user);
    return this.prisma.scheduledMessage.create({
      data: {
        conversationId: dto.conversationId,
        senderId: user.sub,
        body: sanitizePrompt(dto.body),
        sendAt: new Date(dto.sendAt),
      },
    });
  }

  async listScheduled(user: JwtPayload) {
    return this.prisma.scheduledMessage.findMany({
      where: { senderId: user.sub, sentAt: null },
      orderBy: { sendAt: 'asc' },
    });
  }

  async cancelScheduled(id: string, user: JwtPayload) {
    const scheduled = await this.prisma.scheduledMessage.findUnique({ where: { id } });
    if (!scheduled) throw new NotFoundException('Scheduled message not found');
    if (scheduled.senderId !== user.sub && user.role !== 'ADMIN') {
      throw new ForbiddenException('You cannot cancel another user’s scheduled message');
    }
    if (scheduled.sentAt) throw new BadRequestException('This message has already been sent');
    await this.prisma.scheduledMessage.delete({ where: { id } });
    return { success: true };
  }

  /** Resolves and persists recipients once per Message, not re-resolved on every read. */
  async resolveRecipients(
    conversation: { id: string; type: string; courseId: string | null; batchId: string | null },
    senderId: string,
  ): Promise<string[]> {
    if (conversation.type === 'DIRECT' || conversation.type === 'GROUP') {
      const participants = await this.prisma.conversationParticipant.findMany({
        where: { conversationId: conversation.id },
        select: { userId: true },
      });
      return participants.map((p) => p.userId).filter((id) => id !== senderId);
    }

    if (conversation.type === 'COURSE_BROADCAST' && conversation.courseId) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { courseId: conversation.courseId },
        select: { studentId: true },
      });
      return enrollments.map((e) => e.studentId);
    }

    if (conversation.type === 'BATCH_BROADCAST' && conversation.batchId) {
      const enrollments = await this.prisma.batchEnrollment.findMany({
        where: { batchId: conversation.batchId },
        select: { studentId: true },
      });
      return enrollments.map((e) => e.studentId);
    }

    return [];
  }

  private assertOwnership(user: JwtPayload, facultyId: string) {
    if (!isOwnerOrAdmin(user, facultyId)) {
      throw new ForbiddenException('You do not own this course or batch');
    }
  }

  private assertCanPost(
    conversation: { type: string; course: { facultyId: string } | null; batch: { course: { facultyId: string } } | null },
    user: JwtPayload,
  ) {
    if (conversation.type !== 'COURSE_BROADCAST' && conversation.type !== 'BATCH_BROADCAST') return;
    const facultyId = conversation.type === 'COURSE_BROADCAST' ? conversation.course?.facultyId : conversation.batch?.course.facultyId;
    if (!facultyId || !isOwnerOrAdmin(user, facultyId)) {
      throw new ForbiddenException('Only the course/batch owner can post to this broadcast');
    }
  }

  async requireParticipantAccess(user: JwtPayload, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { course: true, batch: { include: { course: true } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    if (conversation.type === 'DIRECT' || conversation.type === 'GROUP') {
      const participant = await this.prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId: user.sub } },
      });
      if (!participant) throw new ForbiddenException('You are not part of this conversation');
      return conversation;
    }

    if (conversation.type === 'COURSE_BROADCAST' && conversation.course) {
      if (isOwnerOrAdmin(user, conversation.course.facultyId)) return conversation;
      const enrolled = await this.prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.sub, courseId: conversation.course.id } },
      });
      if (!enrolled) throw new ForbiddenException('You do not have access to this conversation');
      return conversation;
    }

    if (conversation.type === 'BATCH_BROADCAST' && conversation.batch) {
      if (isOwnerOrAdmin(user, conversation.batch.course.facultyId)) return conversation;
      const enrolled = await this.prisma.batchEnrollment.findUnique({
        where: { batchId_studentId: { batchId: conversation.batch.id, studentId: user.sub } },
      });
      if (!enrolled) throw new ForbiddenException('You do not have access to this conversation');
      return conversation;
    }

    throw new ForbiddenException('You do not have access to this conversation');
  }
}
