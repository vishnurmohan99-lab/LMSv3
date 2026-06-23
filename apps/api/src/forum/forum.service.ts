import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { withUniqueNameCheck } from '../common/unique-violation';
import { CreateForumCategoryDto } from './dto/create-forum-category.dto';
import { UpdateForumCategoryDto } from './dto/update-forum-category.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import type { ForumAccessMode, ForumCategory } from '../../generated/prisma/client';

const AUTHOR_SELECT = { id: true, fullName: true, role: true } as const;

type Purpose = 'AUDIENCE' | 'POST' | 'COMMENT';

@Injectable()
export class ForumService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Categories (admin-managed) ----------

  async listCategoriesForAdmin() {
    const categories = await this.prisma.forumCategory.findMany({
      include: {
        batch: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
        _count: { select: { threads: true } },
        permissionUsers: { include: { user: { select: { id: true, fullName: true, email: true, role: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return categories.map((c) => this.shapeCategoryForAdmin(c));
  }

  async getCategoryForAdmin(id: string) {
    const category = await this.prisma.forumCategory.findUnique({
      where: { id },
      include: {
        batch: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
        _count: { select: { threads: true } },
        permissionUsers: { include: { user: { select: { id: true, fullName: true, email: true, role: true } } } },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return this.shapeCategoryForAdmin(category);
  }

  private shapeCategoryForAdmin(
    c: ForumCategory & {
      batch: { id: string; name: string } | null;
      course: { id: string; title: string } | null;
      _count: { threads: number };
      permissionUsers: { purpose: Purpose; user: { id: string; fullName: string; email: string; role: string } }[];
    },
  ) {
    const byPurpose = (p: Purpose) => c.permissionUsers.filter((pu) => pu.purpose === p).map((pu) => pu.user);
    return {
      ...c,
      threadCount: c._count.threads,
      audienceUsers: byPurpose('AUDIENCE'),
      postUsers: byPurpose('POST'),
      commentUsers: byPurpose('COMMENT'),
    };
  }

  async createCategory(admin: JwtPayload, dto: CreateForumCategoryDto) {
    if (dto.scopeType === 'BATCH') {
      if (!dto.batchId) throw new BadRequestException('batchId is required for a Batch category');
      const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
      if (!batch) throw new BadRequestException('Batch not found');
    } else if (dto.scopeType === 'COURSE') {
      if (!dto.courseId) throw new BadRequestException('courseId is required for a Course category');
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course) throw new BadRequestException('Course not found');
    }

    const category = await withUniqueNameCheck(
      () =>
        this.prisma.forumCategory.create({
          data: {
            name: dto.name.trim(),
            scopeType: dto.scopeType,
            batchId: dto.scopeType === 'BATCH' ? dto.batchId : undefined,
            courseId: dto.scopeType === 'COURSE' ? dto.courseId : undefined,
            audienceFacultyMode: dto.audienceFacultyMode,
            audienceStudentMode: dto.audienceStudentMode,
            postFacultyMode: dto.postFacultyMode,
            postStudentMode: dto.postStudentMode,
            commentFacultyMode: dto.commentFacultyMode,
            commentStudentMode: dto.commentStudentMode,
            createdById: admin.sub,
          },
        }),
      'forum category',
    );

    await this.replacePermissionUsers(category.id, 'AUDIENCE', dto.audienceUserIds);
    await this.replacePermissionUsers(category.id, 'POST', dto.postUserIds);
    await this.replacePermissionUsers(category.id, 'COMMENT', dto.commentUserIds);

    return this.getCategoryForAdmin(category.id);
  }

  async updateCategory(id: string, dto: UpdateForumCategoryDto) {
    await this.requireCategory(id);
    await withUniqueNameCheck(
      () =>
        this.prisma.forumCategory.update({
          where: { id },
          data: {
            name: dto.name?.trim(),
            audienceFacultyMode: dto.audienceFacultyMode,
            audienceStudentMode: dto.audienceStudentMode,
            postFacultyMode: dto.postFacultyMode,
            postStudentMode: dto.postStudentMode,
            commentFacultyMode: dto.commentFacultyMode,
            commentStudentMode: dto.commentStudentMode,
          },
        }),
      'forum category',
    );

    if (dto.audienceUserIds !== undefined) await this.replacePermissionUsers(id, 'AUDIENCE', dto.audienceUserIds);
    if (dto.postUserIds !== undefined) await this.replacePermissionUsers(id, 'POST', dto.postUserIds);
    if (dto.commentUserIds !== undefined) await this.replacePermissionUsers(id, 'COMMENT', dto.commentUserIds);

    return this.getCategoryForAdmin(id);
  }

  async deleteCategory(id: string) {
    await this.requireCategory(id);
    await this.prisma.forumCategory.delete({ where: { id } });
    return { success: true };
  }

  private async replacePermissionUsers(categoryId: string, purpose: Purpose, userIds: string[] | undefined) {
    if (userIds === undefined) return;
    await this.prisma.forumCategoryUser.deleteMany({ where: { categoryId, purpose } });
    if (userIds.length > 0) {
      await this.prisma.forumCategoryUser.createMany({
        data: userIds.map((userId) => ({ categoryId, userId, purpose })),
      });
    }
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.forumCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // ---------- Audience / permission checks ----------

  private async isCategoryMember(category: ForumCategory, user: JwtPayload): Promise<boolean> {
    if (user.role === 'ADMIN' || user.role === 'FACULTY') return true;
    if (category.scopeType === 'BATCH') {
      const m = await this.prisma.batchEnrollment.findUnique({
        where: { batchId_studentId: { batchId: category.batchId!, studentId: user.sub } },
      });
      return !!m;
    }
    if (category.scopeType === 'COURSE') {
      const m = await this.prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.sub, courseId: category.courseId! } },
      });
      return !!m;
    }
    // GENERAL audience is governed by audienceStudentMode/audienceFacultyMode, checked by hasPermission.
    return this.hasPermission(category, user, 'AUDIENCE');
  }

  private async hasPermission(category: ForumCategory, user: JwtPayload, purpose: Purpose): Promise<boolean> {
    if (user.role === 'ADMIN') return true;

    if (purpose !== 'AUDIENCE' && category.scopeType !== 'GENERAL') {
      const isMember = await this.isCategoryMember(category, user);
      if (!isMember) return false;
    }

    const modes: Record<Purpose, { faculty: ForumAccessMode; student: ForumAccessMode }> = {
      AUDIENCE: { faculty: category.audienceFacultyMode, student: category.audienceStudentMode },
      POST: { faculty: category.postFacultyMode, student: category.postStudentMode },
      COMMENT: { faculty: category.commentFacultyMode, student: category.commentStudentMode },
    };
    const mode = user.role === 'FACULTY' ? modes[purpose].faculty : modes[purpose].student;

    if (mode === 'ALL') return true;
    if (mode === 'NONE') return false;
    const selected = await this.prisma.forumCategoryUser.findUnique({
      where: { categoryId_userId_purpose: { categoryId: category.id, userId: user.sub, purpose } },
    });
    return !!selected;
  }

  private async assertCanAccess(category: ForumCategory, user: JwtPayload) {
    const allowed = await this.isCategoryMember(category, user);
    if (!allowed) throw new ForbiddenException('You do not have access to this forum category');
  }

  // ---------- Categories visible to the current user ----------

  async listCategoriesForUser(user: JwtPayload) {
    const categories = await this.prisma.forumCategory.findMany({
      include: { _count: { select: { threads: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const visible: { id: string; name: string; scopeType: string; count: number; canPost: boolean; canComment: boolean }[] = [];
    for (const c of categories) {
      if (await this.isCategoryMember(c, user)) {
        visible.push({
          id: c.id,
          name: c.name,
          scopeType: c.scopeType,
          count: c._count.threads,
          canPost: await this.hasPermission(c, user, 'POST'),
          canComment: await this.hasPermission(c, user, 'COMMENT'),
        });
      }
    }
    return visible;
  }

  // ---------- Threads ----------

  async listThreads(user: JwtPayload, categoryId: string | undefined, search: string | undefined) {
    const where: { categoryId?: string; title?: { contains: string; mode: 'insensitive' } } = {};
    if (categoryId && categoryId !== 'all') where.categoryId = categoryId;
    if (search) where.title = { contains: search, mode: 'insensitive' };

    const threads = await this.prisma.forumThread.findMany({
      where,
      include: { author: { select: AUTHOR_SELECT }, category: true, _count: { select: { posts: true, likes: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });

    const visible: Omit<(typeof threads)[number], 'category'>[] = [];
    for (const t of threads) {
      if (await this.isCategoryMember(t.category, user)) {
        const { category, ...rest } = t;
        visible.push(rest);
      }
    }
    return visible;
  }

  async getThread(id: string, user: JwtPayload) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: AUTHOR_SELECT },
        category: true,
        posts: { include: { author: { select: AUTHOR_SELECT } }, orderBy: { createdAt: 'asc' } },
        _count: { select: { posts: true, likes: true } },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    await this.assertCanAccess(thread.category, user);
    const likedByMe = !!(await this.prisma.forumThreadLike.findUnique({ where: { threadId_userId: { threadId: id, userId: user.sub } } }));
    const canComment = !thread.locked && (await this.hasPermission(thread.category, user, 'COMMENT'));
    const { category, ...rest } = thread;
    return { ...rest, likedByMe, canComment };
  }

  async createThread(user: JwtPayload, dto: CreateThreadDto) {
    const category = await this.requireCategory(dto.categoryId);
    await this.assertCanAccess(category, user);
    if (!(await this.hasPermission(category, user, 'POST'))) {
      throw new ForbiddenException('You do not have permission to post in this category');
    }
    return this.prisma.forumThread.create({
      data: { title: dto.title.trim(), body: dto.body.trim(), categoryId: category.id, authorId: user.sub },
      include: { author: { select: AUTHOR_SELECT }, _count: { select: { posts: true, likes: true } } },
    });
  }

  async addPost(user: JwtPayload, threadId: string, dto: CreatePostDto) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId }, include: { category: true } });
    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.locked) throw new ForbiddenException('This thread is locked');
    await this.assertCanAccess(thread.category, user);
    if (!(await this.hasPermission(thread.category, user, 'COMMENT'))) {
      throw new ForbiddenException('You do not have permission to comment in this category');
    }
    return this.prisma.forumPost.create({
      data: { threadId, authorId: user.sub, body: dto.body.trim() },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  async toggleLike(user: JwtPayload, threadId: string) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId }, include: { category: true } });
    if (!thread) throw new NotFoundException('Thread not found');
    await this.assertCanAccess(thread.category, user);
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
