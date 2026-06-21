import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';

const AUTHOR_SELECT = { id: true, fullName: true, role: true } as const;

@Injectable()
export class ForumService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCanPost(user: JwtPayload) {
    if (user.role === 'ADMIN' || user.role === 'FACULTY') return;
    const enrollment = await this.prisma.enrollment.findFirst({ where: { studentId: user.sub } });
    if (!enrollment) throw new ForbiddenException('You must be enrolled in a course to post in the forum');
  }

  async listCategories() {
    const courses = await this.prisma.course.findMany({
      where: { published: true },
      select: { id: true, title: true, _count: { select: { forumThreads: true } } },
      orderBy: { title: 'asc' },
    });
    const generalCount = await this.prisma.forumThread.count({ where: { courseId: null } });
    return [
      { id: 'general', name: 'General', count: generalCount },
      ...courses.map((c) => ({ id: c.id, name: c.title, count: c._count.forumThreads })),
    ];
  }

  async listThreads(categoryId: string | undefined, search: string | undefined) {
    const where: { courseId?: string | null; title?: { contains: string; mode: 'insensitive' } } = {};
    if (categoryId === 'general') where.courseId = null;
    else if (categoryId && categoryId !== 'all') where.courseId = categoryId;
    if (search) where.title = { contains: search, mode: 'insensitive' };

    const threads = await this.prisma.forumThread.findMany({
      where,
      include: { author: { select: AUTHOR_SELECT }, _count: { select: { posts: true, likes: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
    return threads;
  }

  async getThread(id: string, user: JwtPayload) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: AUTHOR_SELECT },
        posts: { include: { author: { select: AUTHOR_SELECT } }, orderBy: { createdAt: 'asc' } },
        _count: { select: { posts: true, likes: true } },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    const likedByMe = !!(await this.prisma.forumThreadLike.findUnique({ where: { threadId_userId: { threadId: id, userId: user.sub } } }));
    return { ...thread, likedByMe };
  }

  async createThread(user: JwtPayload, dto: CreateThreadDto) {
    await this.assertCanPost(user);
    if (dto.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course) throw new BadRequestException('Course not found');
    }
    return this.prisma.forumThread.create({
      data: { title: dto.title.trim(), body: dto.body.trim(), courseId: dto.courseId ?? null, authorId: user.sub },
      include: { author: { select: AUTHOR_SELECT }, _count: { select: { posts: true, likes: true } } },
    });
  }

  async addPost(user: JwtPayload, threadId: string, dto: CreatePostDto) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.locked) throw new ForbiddenException('This thread is locked');
    await this.assertCanPost(user);
    return this.prisma.forumPost.create({
      data: { threadId, authorId: user.sub, body: dto.body.trim() },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  async toggleLike(user: JwtPayload, threadId: string) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Thread not found');
    const existing = await this.prisma.forumThreadLike.findUnique({ where: { threadId_userId: { threadId, userId: user.sub } } });
    if (existing) {
      await this.prisma.forumThreadLike.delete({ where: { id: existing.id } });
      return { liked: false };
    }
    await this.prisma.forumThreadLike.create({ data: { threadId, userId: user.sub } });
    return { liked: true };
  }

  async updateThread(threadId: string, dto: UpdateThreadDto) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Thread not found');
    return this.prisma.forumThread.update({
      where: { id: threadId },
      data: { ...(dto.pinned !== undefined && { pinned: dto.pinned }), ...(dto.locked !== undefined && { locked: dto.locked }) },
    });
  }
}
