import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { CoursesService } from '../courses/courses.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ChatRole } from '../../generated/prisma/client';

const HISTORY_LIMIT = 10;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly courses: CoursesService,
  ) {}

  async getHistory(lessonId: string, user: JwtPayload) {
    await this.courses.requireLessonContextForChat(lessonId, user);
    return this.prisma.chatMessage.findMany({
      where: { lessonId, studentId: user.sub },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(lessonId: string, user: JwtPayload, message: string) {
    const lessonContent = await this.courses.requireLessonContextForChat(lessonId, user);

    const history = await this.prisma.chatMessage.findMany({
      where: { lessonId, studentId: user.sub },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    history.reverse();

    const historyText = history.map((m) => `${m.role === ChatRole.USER ? 'Student' : 'Assistant'}: ${m.content}`).join('\n');

    const prompt = `You are a helpful tutor answering a student's question about a specific lesson. Answer only using the lesson content below. If the answer isn't in the content, say you don't have that information in this lesson.\n\nLesson content:\n${lessonContent}\n\n${historyText ? `Conversation so far:\n${historyText}\n\n` : ''}Student: ${message}\nAssistant:`;

    const reply = await this.ai.complete(prompt);

    const [userMessage, assistantMessage] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: { lessonId, studentId: user.sub, role: ChatRole.USER, content: message },
      }),
      this.prisma.chatMessage.create({
        data: { lessonId, studentId: user.sub, role: ChatRole.ASSISTANT, content: reply.trim() },
      }),
    ]);

    return assistantMessage;
  }

  async resetHistory(lessonId: string, user: JwtPayload) {
    await this.courses.requireLessonContextForChat(lessonId, user);
    await this.prisma.chatMessage.deleteMany({ where: { lessonId, studentId: user.sub } });
    return { success: true };
  }
}
