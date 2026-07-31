import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { NoteScope, Prisma } from '../../generated/prisma/client';
import { CreateNotesBankDto } from './dto/create-notes-bank.dto';
import { UpdateNotesBankDto } from './dto/update-notes-bank.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

const TX = { maxWait: 15000, timeout: 15000 } as const;

/**
 * PDF or image, decided from the extension. The viewer renders each differently — a PDF goes
 * in an <iframe>, an image on the zoomable paper stage — so the client needs this per file
 * rather than per set: a set can mix a scanned PDF with photographed pages.
 */
function fileKind(nameOrKey: string): 'PDF' | 'IMAGE' {
  return /\.pdf(\?|$)/i.test(nameOrKey) ? 'PDF' : 'IMAGE';
}

/** Normalized targeting for a bank, ready to write. */
interface ResolvedScope {
  scope: NoteScope;
  courseId: string | null;
  lessonId: string | null;
  batchIds: string[];
}

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  private isOwnerOrAdmin(user: JwtPayload, createdById: string) {
    return user.role === 'ADMIN' || user.sub === createdById;
  }

  /**
   * Validate a bank's targeting and strip the fields the chosen scope doesn't use, so a bank
   * can never carry a stale courseId that silently widens who sees it. Referenced course,
   * lesson and batches are checked to exist — a typo'd id must fail loudly at write time
   * rather than produce a bank nobody can ever see.
   */
  private async resolveScope(
    scope: NoteScope,
    dto: { courseId?: string | null; lessonId?: string | null; batchIds?: string[] },
  ): Promise<ResolvedScope> {
    if (scope === 'GENERAL') {
      return { scope, courseId: null, lessonId: null, batchIds: [] };
    }

    if (scope === 'COURSE') {
      if (!dto.courseId) throw new BadRequestException('A course is required for course-scoped notes');
      await this.requireCourse(dto.courseId);
      return { scope, courseId: dto.courseId, lessonId: null, batchIds: [] };
    }

    if (scope === 'LESSON') {
      if (!dto.lessonId) throw new BadRequestException('A lesson is required for lesson-scoped notes');
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: dto.lessonId },
        select: { id: true, chapter: { select: { courseId: true } } },
      });
      if (!lesson) throw new NotFoundException('Lesson not found');
      // Derived, never taken from the client: the lesson's own course is the only coherent one.
      return { scope, courseId: lesson.chapter.courseId, lessonId: lesson.id, batchIds: [] };
    }

    // BATCH
    const batchIds = [...new Set(dto.batchIds ?? [])];
    if (batchIds.length === 0) {
      throw new BadRequestException('At least one batch is required for batch-scoped notes');
    }
    const found = await this.prisma.batch.count({ where: { id: { in: batchIds } } });
    if (found !== batchIds.length) throw new NotFoundException('One or more batches were not found');
    return { scope, courseId: null, lessonId: null, batchIds };
  }

  private async requireCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id }, select: { id: true } });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  // ---- Notes banks (FACULTY/ADMIN) ----
  /**
   * F10 — search and filter. Without this a faculty member two terms in is scrolling an
   * undifferentiated list of hundreds of banks to find the one to add a missed page to.
   */
  async listNotesBanks(
    user: JwtPayload,
    filters: {
      q?: string;
      scope?: NoteScope;
      courseId?: string;
      batchId?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const and: Prisma.NotesBankWhereInput[] = [];

    if (user.role !== 'ADMIN') and.push({ OR: [{ published: true }, { createdById: user.sub }] });
    if (filters.q?.trim()) and.push({ title: { contains: filters.q.trim(), mode: 'insensitive' } });
    if (filters.scope) and.push({ scope: filters.scope });
    if (filters.courseId) and.push({ courseId: filters.courseId });
    if (filters.batchId) and.push({ batches: { some: { batchId: filters.batchId } } });

    // Date range applies to the class the notes cover, not when they were uploaded — a faculty
    // member searching "last week's classes" means the sessions, not the upload timestamps.
    const dateFilter = this.dateRange(filters.from, filters.to);
    if (dateFilter) and.push({ sessionDate: dateFilter });

    return this.prisma.notesBank.findMany({
      where: and.length ? { AND: and } : {},
      // Banks with no session date sort by upload time, so undated sets don't sink to the end.
      orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { notes: true } },
        batches: { include: { batch: { select: { id: true, name: true } } } },
        course: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
      },
    });
  }

  /** Inclusive day range: `to` is pushed to the end of its day so a single-day filter works. */
  private dateRange(from?: string, to?: string) {
    if (!from && !to) return undefined;
    const range: Prisma.DateTimeFilter = {};
    if (from) range.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    return range;
  }

  async getNotesBank(id: string, user: JwtPayload) {
    const bank = await this.prisma.notesBank.findUnique({
      where: { id },
      include: {
        batches: { include: { batch: { select: { id: true, name: true } } } },
        notes: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          include: { course: { select: { id: true, title: true } }, chapter: { select: { id: true, title: true } } },
        },
      },
    });
    if (!bank) throw new NotFoundException('Notes bank not found');
    if (!this.isOwnerOrAdmin(user, bank.createdById) && !bank.published) {
      throw new ForbiddenException('You do not have access to this notes bank');
    }
    const notes = await Promise.all(
      bank.notes.map(async (n) => ({ ...n, fileUrl: await this.uploads.presignDownload(n.fileUrl) })),
    );
    return { ...bank, notes };
  }

  async createNotesBank(user: JwtPayload, dto: CreateNotesBankDto) {
    // Pre-v2 clients send only { title, batchIds } and mean BATCH.
    const target = await this.resolveScope(dto.scope ?? 'BATCH', dto);
    return this.prisma.notesBank.create({
      data: {
        title: dto.title,
        createdById: user.sub,
        scope: target.scope,
        courseId: target.courseId,
        lessonId: target.lessonId,
        sessionDate: dto.sessionDate ? new Date(dto.sessionDate) : null,
        batches: target.batchIds.length ? { create: target.batchIds.map((batchId) => ({ batchId })) } : undefined,
      },
      include: {
        batches: { include: { batch: { select: { id: true, name: true } } } },
        course: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
        _count: { select: { notes: true } },
      },
    });
  }

  async updateNotesBank(id: string, user: JwtPayload, dto: UpdateNotesBankDto) {
    const bank = await this.requireBank(id);
    this.assertOwner(user, bank.createdById);

    // Re-resolve targeting whenever the scope OR any target field is touched. Resolving against
    // the merged (stored + incoming) values means changing only the scope still validates, and
    // the resolver clears whatever the new scope doesn't use.
    const retarget =
      dto.scope !== undefined ||
      dto.courseId !== undefined ||
      dto.lessonId !== undefined ||
      dto.batchIds !== undefined;

    let target: ResolvedScope | null = null;
    if (retarget) {
      const existingBatchIds = await this.prisma.notesBankBatch.findMany({
        where: { notesBankId: id },
        select: { batchId: true },
      });
      target = await this.resolveScope(dto.scope ?? bank.scope, {
        courseId: dto.courseId !== undefined ? dto.courseId : bank.courseId,
        lessonId: dto.lessonId !== undefined ? dto.lessonId : bank.lessonId,
        batchIds: dto.batchIds ?? existingBatchIds.map((b) => b.batchId),
      });
    }

    return this.prisma.$transaction(async (tx) => {
      if (target) {
        await tx.notesBankBatch.deleteMany({ where: { notesBankId: id } });
        if (target.batchIds.length) {
          await tx.notesBankBatch.createMany({
            data: target.batchIds.map((batchId) => ({ notesBankId: id, batchId })),
            skipDuplicates: true,
          });
        }
      }
      return tx.notesBank.update({
        where: { id },
        data: {
          title: dto.title,
          published: dto.published,
          ...(target ? { scope: target.scope, courseId: target.courseId, lessonId: target.lessonId } : {}),
          ...(dto.sessionDate === undefined
            ? {}
            : { sessionDate: dto.sessionDate === null ? null : new Date(dto.sessionDate) }),
        },
        include: {
          batches: { include: { batch: { select: { id: true, name: true } } } },
          course: { select: { id: true, title: true } },
          lesson: { select: { id: true, title: true } },
          _count: { select: { notes: true } },
        },
      });
    }, TX);
  }

  async deleteNotesBank(id: string, user: JwtPayload) {
    const bank = await this.requireBank(id);
    this.assertOwner(user, bank.createdById);
    await this.prisma.notesBank.delete({ where: { id } });
    return { success: true };
  }

  // ---- Notes (FACULTY/ADMIN) ----
  async createNote(bankId: string, user: JwtPayload, dto: CreateNoteDto) {
    const bank = await this.requireBank(bankId);
    this.assertOwner(user, bank.createdById);
    const max = await this.prisma.note.aggregate({ where: { notesBankId: bankId }, _max: { order: true } });
    return this.prisma.note.create({
      data: {
        name: dto.name,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        courseId: dto.courseId,
        chapterId: dto.chapterId ?? null,
        notesBankId: bankId,
        order: (max._max.order ?? -1) + 1,
      },
      include: { course: { select: { id: true, title: true } }, chapter: { select: { id: true, title: true } } },
    });
  }

  async updateNote(id: string, user: JwtPayload, dto: UpdateNoteDto) {
    const note = await this.prisma.note.findUnique({ where: { id }, include: { notesBank: { select: { createdById: true } } } });
    if (!note) throw new NotFoundException('Note not found');
    this.assertOwner(user, note.notesBank.createdById);
    return this.prisma.note.update({
      where: { id },
      data: {
        name: dto.name,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        courseId: dto.courseId,
        chapterId: dto.chapterId === undefined ? undefined : dto.chapterId,
      },
      include: { course: { select: { id: true, title: true } }, chapter: { select: { id: true, title: true } } },
    });
  }

  async deleteNote(id: string, user: JwtPayload) {
    const note = await this.prisma.note.findUnique({ where: { id }, include: { notesBank: { select: { createdById: true } } } });
    if (!note) throw new NotFoundException('Note not found');
    this.assertOwner(user, note.notesBank.createdById);
    await this.prisma.note.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Every way a published bank can reach one student. This is the access-control boundary for
   * the whole feature — a bank not matched here is invisible, and nothing downstream re-checks.
   */
  private visibleBankFilter(studentId: string): Prisma.NotesBankWhereInput {
    return {
      published: true,
      OR: [
        { scope: 'GENERAL' },
        // COURSE and LESSON both hang off course enrolment; a LESSON bank always carries its
        // lesson's course (resolveScope derives it), so one clause covers both.
        {
          scope: { in: ['COURSE', 'LESSON'] },
          course: { enrollments: { some: { studentId } } },
        },
        { scope: 'BATCH', batches: { some: { batch: { enrollments: { some: { studentId } } } } } },
      ],
    };
  }

  /**
   * Student notes list.
   *
   * Still one row per file rather than per set — the set-grouped payload the redesign calls for
   * lands with the new student UI, and changing the shape now would break the shipped page.
   * What is new: all four scopes resolve here, and each row carries its bank's scope and
   * session date so the list can label where a note applies.
   */
  async listMyNotes(
    user: JwtPayload,
    filters: { q?: string; courseId?: string; chapterId?: string; batchId?: string; from?: string; to?: string },
  ) {
    const all = await this.prisma.note.findMany({
      where: { notesBank: this.visibleBankFilter(user.sub) },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        chapter: { select: { id: true, title: true } },
        notesBank: {
          select: {
            id: true,
            title: true,
            scope: true,
            sessionDate: true,
            course: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
            batches: { include: { batch: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    // The bank owns the course now; the file's own courseId is legacy and only a fallback for
    // rows created before the scope migration.
    const courseOf = (n: (typeof all)[number]) => n.notesBank.course ?? n.course;

    // Facets come from everything the student can reach, not the filtered subset, so the
    // dropdowns don't shrink as you narrow.
    const courseMap = new Map<string, { id: string; title: string }>();
    const chapterMap = new Map<string, { id: string; title: string; courseId: string }>();
    const batchMap = new Map<string, { id: string; name: string }>();
    for (const n of all) {
      const course = courseOf(n);
      if (course) courseMap.set(course.id, course);
      if (n.chapter && course) {
        chapterMap.set(n.chapter.id, { id: n.chapter.id, title: n.chapter.title, courseId: course.id });
      }
      for (const link of n.notesBank.batches) batchMap.set(link.batch.id, link.batch);
    }

    const q = filters.q?.trim().toLowerCase();
    const from = filters.from ? new Date(filters.from) : null;
    const to = filters.to ? new Date(new Date(filters.to).setHours(23, 59, 59, 999)) : null;

    const filtered = all.filter((n) => {
      const course = courseOf(n);
      // Undated sets fall back to their upload time so a date filter never hides them arbitrarily.
      const when = n.notesBank.sessionDate ?? n.createdAt;
      return (
        (!q || n.name.toLowerCase().includes(q) || n.notesBank.title.toLowerCase().includes(q)) &&
        (!filters.courseId || course?.id === filters.courseId) &&
        (!filters.chapterId || n.chapter?.id === filters.chapterId) &&
        (!filters.batchId || n.notesBank.batches.some((b) => b.batch.id === filters.batchId)) &&
        (!from || when >= from) &&
        (!to || when <= to)
      );
    });

    const notes = await Promise.all(
      filtered.map(async (n) => ({
        ...n,
        // Flattened onto the row so the list can render a scope chip without reaching into the
        // bank, and so the shipped page's `n.course.title` keeps resolving.
        course: courseOf(n),
        scope: n.notesBank.scope,
        sessionDate: n.notesBank.sessionDate,
        fileUrl: await this.uploads.presignDownload(n.fileUrl),
      })),
    );

    return {
      notes,
      courses: [...courseMap.values()].sort((a, b) => a.title.localeCompare(b.title)),
      chapters: [...chapterMap.values()].sort((a, b) => a.title.localeCompare(b.title)),
      batches: [...batchMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /**
   * Student notes, grouped as SETS — one entry per bank, however many pages it holds.
   *
   * Added alongside `listMyNotes` rather than replacing it: the shipped student page consumes
   * the flat shape, and changing it under a deployed client would break the page between the
   * API and web deploys.
   */
  async listMyNoteSets(
    user: JwtPayload,
    filters: { q?: string; courseId?: string; batchId?: string; from?: string; to?: string },
  ) {
    const banks = await this.prisma.notesBank.findMany({
      where: this.visibleBankFilter(user.sub),
      orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        course: { select: { id: true, title: true } },
        lesson: { select: { id: true, title: true } },
        batches: { include: { batch: { select: { id: true, name: true } } } },
        notes: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    // Facets span everything reachable, not the filtered subset, so the dropdowns don't shrink
    // as the list narrows.
    const courseMap = new Map<string, { id: string; title: string }>();
    const batchMap = new Map<string, { id: string; name: string }>();
    for (const b of banks) {
      if (b.course) courseMap.set(b.course.id, b.course);
      for (const link of b.batches) batchMap.set(link.batch.id, link.batch);
    }

    const q = filters.q?.trim().toLowerCase();
    const from = filters.from ? new Date(filters.from) : null;
    const to = filters.to ? new Date(new Date(filters.to).setHours(23, 59, 59, 999)) : null;

    const matched = banks.filter((b) => {
      // Undated sets fall back to upload time so a date filter never hides them arbitrarily.
      const when = b.sessionDate ?? b.createdAt;
      return (
        (!q || b.title.toLowerCase().includes(q)) &&
        (!filters.courseId || b.courseId === filters.courseId) &&
        (!filters.batchId || b.batches.some((l) => l.batchId === filters.batchId)) &&
        (!from || when >= from) &&
        (!to || when <= to)
      );
    });

    const sets = await Promise.all(
      matched.map(async (b) => ({
        id: b.id,
        title: b.title,
        scope: b.scope,
        sessionDate: b.sessionDate,
        createdAt: b.createdAt,
        course: b.course,
        lesson: b.lesson,
        batches: b.batches.map((l) => l.batch),
        pageCount: b.notes.length,
        files: await Promise.all(
          b.notes.map(async (n) => ({
            id: n.id,
            name: n.name,
            fileName: n.fileName,
            order: n.order,
            kind: fileKind(n.fileName ?? n.fileUrl),
            fileUrl: await this.uploads.presignDownload(n.fileUrl),
          })),
        ),
      })),
    );

    // An empty set has nothing to open — it's a bank the faculty hasn't finished filling in.
    return {
      sets: sets.filter((s) => s.pageCount > 0),
      courses: [...courseMap.values()].sort((a, b) => a.title.localeCompare(b.title)),
      batches: [...batchMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  private async requireBank(id: string) {
    const bank = await this.prisma.notesBank.findUnique({ where: { id } });
    if (!bank) throw new NotFoundException('Notes bank not found');
    return bank;
  }

  private assertOwner(user: JwtPayload, createdById: string) {
    if (!this.isOwnerOrAdmin(user, createdById)) throw new ForbiddenException('You do not own this notes bank');
  }
}
