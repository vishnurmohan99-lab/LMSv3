import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { StoryViewDto } from './dto/story-view.dto';

/**
 * Success Stories — short testimonial clips.
 *
 * Media is served as raw R2 objects behind presigned GET URLs (same as lesson video); there
 * is no transcoding pipeline, so the hover preview reuses the full clip muted and the poster
 * is author-uploaded. Clips are 20–25s, which keeps that honest.
 */
@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  private isAdmin(user: JwtPayload) {
    return user.role === 'ADMIN';
  }

  /** Faculty may only touch their own stories; admins may touch anything. */
  private assertCanEdit(user: JwtPayload, story: { createdById: string }) {
    if (!this.isAdmin(user) && story.createdById !== user.sub) {
      throw new ForbiddenException('You can only manage stories you created');
    }
  }

  private async requireStory(id: string) {
    const story = await this.prisma.story.findUnique({ where: { id }, include: { segments: true } });
    if (!story) throw new NotFoundException('Story not found');
    return story;
  }

  /** Presign the private R2 keys. Both are needed even on the rail — the poster is the card. */
  private async withMedia<T extends { videoKey: string; posterKey: string }>(story: T) {
    const [videoUrl, posterUrl] = await Promise.all([
      this.uploads.presignDownload(story.videoKey).catch(() => null),
      this.uploads.presignDownload(story.posterKey).catch(() => null),
    ]);
    return { ...story, videoUrl, posterUrl };
  }

  // ==========================================================================
  // Student
  // ==========================================================================

  /**
   * The rail feed. Visibility is the security-critical filter (§7.3): a story reaches a
   * student only if it is PUBLISHED, inside its publish/expiry window, and either flagged
   * allSegments or tagged to the student's own segment. A student with no segment set sees
   * allSegments stories only — never another segment's testimonials.
   */
  /**
   * The single source of truth for "can this student see this story" — published, inside its
   * window, and either LMS-wide or tagged to their segment. Every student-facing read and
   * write goes through this, so the rule can't drift between the feed and the write paths.
   */
  private async visibilityWhere(user: JwtPayload) {
    const me = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { segmentId: true },
    });
    const now = new Date();
    const audience = me?.segmentId
      ? [{ allSegments: true }, { segments: { some: { segmentId: me.segmentId } } }]
      : [{ allSegments: true }];

    return {
      status: 'PUBLISHED' as const,
      AND: [
        { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: audience },
      ],
    };
  }

  async getFeed(user: JwtPayload) {
    const stories = await this.prisma.story.findMany({
      where: await this.visibilityWhere(user),
      include: {
        course: { select: { id: true, title: true, thumbnailUrl: true } },
        segments: { include: { segment: { select: { name: true } } } },
        views: { where: { studentId: user.sub }, select: { completed: true, watchedSeconds: true } },
        reactions: { where: { studentId: user.sub }, select: { id: true } },
        _count: { select: { reactions: true } },
      },
      orderBy: [{ pinned: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
    });

    const shaped = await Promise.all(
      stories.map(async (s) => {
        const { views, reactions, _count, segments, ...rest } = s;
        const withMedia = await this.withMedia(rest);
        // The card's sub-line and the viewer's meta line ("CAT '26 · QUANT SPRINT"): derived
        // from the story's real segment/course rather than stored as duplicate free text.
        const contextLabel = [segments.map((x) => x.segment.name).join(' · '), rest.course?.title]
          .filter(Boolean)
          .join(' · ')
          .toUpperCase();
        return {
          ...withMedia,
          contextLabel,
          seen: views.length > 0,
          watchedSeconds: views[0]?.watchedSeconds ?? 0,
          reactionCount: _count.reactions,
          reacted: reactions.length > 0,
        };
      }),
    );

    // The design sorts watched cards last, pinned first. Prisma can't order on a per-student
    // join, so the seen split happens here — the DB ordering above is the tiebreak.
    return [...shaped].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.seen !== b.seen) return a.seen ? 1 : -1;
      return 0;
    });
  }

  /**
   * A student may only act on a story their feed would actually serve them. Deliberately a
   * targeted existence check rather than building the whole feed — view pings fire every few
   * seconds and must not presign every story's media each time.
   */
  private async requireVisibleToStudent(id: string, user: JwtPayload) {
    const visible = await this.prisma.story.findFirst({
      where: { AND: [{ id }, await this.visibilityWhere(user)] },
      select: { id: true },
    });
    // 404 rather than 403: a story outside the student's segment shouldn't confirm it exists.
    if (!visible) throw new NotFoundException('Story not found');
    return visible;
  }

  /**
   * Records progress. `opened` marks the first ping of a sitting so viewCount counts opens
   * rather than pings; watchedSeconds keeps the furthest point reached, so a rewatch can
   * never deflate it and pings can arrive out of order safely.
   */
  async recordView(id: string, user: JwtPayload, dto: StoryViewDto) {
    await this.requireVisibleToStudent(id, user);
    const watched = Math.max(0, dto.watchedSeconds ?? 0);

    const existing = await this.prisma.storyView.findUnique({
      where: { storyId_studentId: { storyId: id, studentId: user.sub } },
      select: { watchedSeconds: true, completed: true, viewCount: true },
    });

    if (!existing) {
      return this.prisma.storyView.create({
        data: {
          storyId: id,
          studentId: user.sub,
          watchedSeconds: watched,
          completed: dto.completed ?? false,
          viewCount: 1,
        },
      });
    }

    return this.prisma.storyView.update({
      where: { storyId_studentId: { storyId: id, studentId: user.sub } },
      data: {
        watchedSeconds: Math.max(existing.watchedSeconds, watched),
        completed: existing.completed || (dto.completed ?? false),
        viewCount: dto.opened ? existing.viewCount + 1 : existing.viewCount,
        lastViewedAt: new Date(),
      },
    });
  }

  /** 🔥 Inspiring — one per student per story, toggled. */
  async toggleReaction(id: string, user: JwtPayload) {
    await this.requireVisibleToStudent(id, user);
    const key = { storyId_studentId: { storyId: id, studentId: user.sub } };
    const existing = await this.prisma.storyReaction.findUnique({ where: key });

    if (existing) await this.prisma.storyReaction.delete({ where: key });
    else await this.prisma.storyReaction.create({ data: { storyId: id, studentId: user.sub } });

    const reactionCount = await this.prisma.storyReaction.count({ where: { storyId: id } });
    return { reacted: !existing, reactionCount };
  }

  // ==========================================================================
  // Authoring (FACULTY / ADMIN)
  // ==========================================================================

  /** Faculty see their own stories; admins see everything, including the moderation queue. */
  async listForAuthor(user: JwtPayload, status?: string) {
    const stories = await this.prisma.story.findMany({
      where: {
        ...(this.isAdmin(user) ? {} : { createdById: user.sub }),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        segments: { include: { segment: { select: { id: true, name: true } } } },
        course: { select: { id: true, title: true } },
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { views: true, reactions: true } },
      },
      orderBy: [{ pinned: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
    });
    return Promise.all(stories.map((s) => this.withMedia(s)));
  }

  private async validateRefs(dto: CreateStoryDto | UpdateStoryDto) {
    if (dto.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course) throw new BadRequestException('Course not found');
    }
    if (dto.segmentIds?.length) {
      const found = await this.prisma.segment.count({ where: { id: { in: dto.segmentIds } } });
      if (found !== new Set(dto.segmentIds).size) throw new BadRequestException('One or more segments not found');
    }
  }

  /** A story nobody can see is a content bug, so require a target unless it's LMS-wide. */
  private assertHasAudience(allSegments: boolean, segmentIds: string[] | undefined) {
    if (!allSegments && !segmentIds?.length) {
      throw new BadRequestException('Tag at least one segment, or mark the story as visible to all segments');
    }
  }

  async create(user: JwtPayload, dto: CreateStoryDto) {
    await this.validateRefs(dto);
    this.assertHasAudience(dto.allSegments ?? false, dto.segmentIds);

    return this.prisma.story.create({
      data: {
        studentName: dto.studentName.trim(),
        avatarInitials: dto.avatarInitials?.trim() || null,
        verified: dto.verified ?? false,
        resultChip: dto.resultChip.trim(),
        videoKey: dto.videoKey,
        posterKey: dto.posterKey,
        durationSeconds: dto.durationSeconds ?? 0,
        orientation: dto.orientation ?? 'PORTRAIT',
        captionsVtt: dto.captionsVtt ?? null,
        quote: dto.quote.trim(),
        body: dto.body?.trim() || null,
        stats: (dto.stats ?? []) as never,
        ctaLabel: dto.ctaLabel?.trim() || null,
        ctaUrl: dto.ctaUrl?.trim() || null,
        courseId: dto.courseId ?? null,
        allSegments: dto.allSegments ?? false,
        pinned: dto.pinned ?? false,
        order: dto.order ?? 0,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: user.sub,
        segments: dto.segmentIds?.length
          ? { create: dto.segmentIds.map((segmentId) => ({ segmentId })) }
          : undefined,
      },
      include: { segments: true },
    });
  }

  async update(id: string, user: JwtPayload, dto: UpdateStoryDto) {
    const story = await this.requireStory(id);
    this.assertCanEdit(user, story);
    await this.validateRefs(dto);

    const nextAllSegments = dto.allSegments ?? story.allSegments;
    const nextSegmentIds = dto.segmentIds ?? story.segments.map((s) => s.segmentId);
    this.assertHasAudience(nextAllSegments, nextSegmentIds);

    // Build the patch explicitly so an absent key is a no-op and a stray key can't slip in.
    const data: Record<string, unknown> = {};
    if (dto.studentName !== undefined) data.studentName = dto.studentName.trim();
    if (dto.avatarInitials !== undefined) data.avatarInitials = dto.avatarInitials?.trim() || null;
    if (dto.verified !== undefined) data.verified = dto.verified;
    if (dto.resultChip !== undefined) data.resultChip = dto.resultChip.trim();
    if (dto.videoKey !== undefined) data.videoKey = dto.videoKey;
    if (dto.posterKey !== undefined) data.posterKey = dto.posterKey;
    if (dto.durationSeconds !== undefined) data.durationSeconds = dto.durationSeconds;
    if (dto.orientation !== undefined) data.orientation = dto.orientation;
    if (dto.captionsVtt !== undefined) data.captionsVtt = dto.captionsVtt || null;
    if (dto.quote !== undefined) data.quote = dto.quote.trim();
    if (dto.body !== undefined) data.body = dto.body?.trim() || null;
    if (dto.stats !== undefined) data.stats = dto.stats;
    if (dto.ctaLabel !== undefined) data.ctaLabel = dto.ctaLabel?.trim() || null;
    if (dto.ctaUrl !== undefined) data.ctaUrl = dto.ctaUrl?.trim() || null;
    if (dto.courseId !== undefined) data.courseId = dto.courseId || null;
    if (dto.allSegments !== undefined) data.allSegments = dto.allSegments;
    if (dto.pinned !== undefined) data.pinned = dto.pinned;
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.publishAt !== undefined) data.publishAt = dto.publishAt ? new Date(dto.publishAt) : null;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (dto.segmentIds !== undefined) {
      data.segments = {
        deleteMany: {},
        create: dto.segmentIds.map((segmentId) => ({ segmentId })),
      };
    }

    return this.prisma.story.update({ where: { id }, data, include: { segments: true } });
  }

  async remove(id: string, user: JwtPayload) {
    const story = await this.requireStory(id);
    this.assertCanEdit(user, story);
    await this.prisma.story.delete({ where: { id } });
    return { success: true };
  }

  async reorder(user: JwtPayload, items: { id: string; order: number }[]) {
    const stories = await this.prisma.story.findMany({
      where: { id: { in: items.map((i) => i.id) } },
      select: { id: true, createdById: true },
    });
    for (const s of stories) this.assertCanEdit(user, s);
    await this.prisma.$transaction(
      items.map((i) => this.prisma.story.update({ where: { id: i.id }, data: { order: i.order } })),
    );
    return { success: true };
  }

  // ==========================================================================
  // Moderation — testimonials are published claims, so nothing goes live unreviewed.
  // ==========================================================================

  /** Faculty send a draft for review; an admin's own draft can be published directly. */
  async submit(id: string, user: JwtPayload) {
    const story = await this.requireStory(id);
    this.assertCanEdit(user, story);
    if (story.status !== 'DRAFT' && story.status !== 'REJECTED') {
      throw new BadRequestException('Only a draft or rejected story can be submitted for review');
    }
    return this.prisma.story.update({
      where: { id },
      data: { status: 'PENDING', rejectionReason: null },
    });
  }

  async approve(id: string, user: JwtPayload) {
    const story = await this.requireStory(id);
    if (story.status !== 'PENDING' && story.status !== 'DRAFT') {
      throw new BadRequestException('Only a pending or draft story can be approved');
    }
    this.assertHasAudience(story.allSegments, story.segments.map((s) => s.segmentId));
    return this.prisma.story.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        reviewedById: user.sub,
        reviewedAt: new Date(),
        rejectionReason: null,
        publishAt: story.publishAt ?? new Date(),
      },
    });
  }

  async reject(id: string, user: JwtPayload, reason?: string) {
    await this.requireStory(id);
    return this.prisma.story.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: user.sub,
        reviewedAt: new Date(),
        rejectionReason: reason?.trim() || null,
      },
    });
  }

  async archive(id: string, user: JwtPayload) {
    const story = await this.requireStory(id);
    this.assertCanEdit(user, story);
    return this.prisma.story.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }

  // ==========================================================================
  // Analytics (F9) — all four figures come from StoryView, no separate event log.
  // ==========================================================================

  async analytics(id: string, user: JwtPayload) {
    const story = await this.requireStory(id);
    this.assertCanEdit(user, story);

    const views = await this.prisma.storyView.findMany({
      where: { storyId: id },
      select: { watchedSeconds: true, completed: true, viewCount: true },
    });

    const uniqueViewers = views.length;
    const totalViews = views.reduce((sum, v) => sum + v.viewCount, 0);
    const avgWatchSeconds = uniqueViewers
      ? Math.round((views.reduce((sum, v) => sum + v.watchedSeconds, 0) / uniqueViewers) * 10) / 10
      : 0;
    const completions = views.filter((v) => v.completed).length;
    const completionRate = uniqueViewers ? Math.round((completions / uniqueViewers) * 1000) / 10 : 0;

    return {
      totalViews,
      uniqueViewers,
      avgWatchSeconds,
      completionRate,
      completions,
      durationSeconds: story.durationSeconds,
      reactionCount: await this.prisma.storyReaction.count({ where: { storyId: id } }),
    };
  }
}
