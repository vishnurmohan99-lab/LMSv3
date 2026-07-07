import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateNotesBankDto } from './dto/create-notes-bank.dto';
import { UpdateNotesBankDto } from './dto/update-notes-bank.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

const TX = { maxWait: 15000, timeout: 15000 } as const;

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  private isOwnerOrAdmin(user: JwtPayload, createdById: string) {
    return user.role === 'ADMIN' || user.sub === createdById;
  }

  // ---- Notes banks (FACULTY/ADMIN) ----
  listNotesBanks(user: JwtPayload) {
    const where = user.role === 'ADMIN' ? {} : { OR: [{ published: true }, { createdById: user.sub }] };
    return this.prisma.notesBank.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { notes: true } },
        batches: { include: { batch: { select: { id: true, name: true } } } },
      },
    });
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

  createNotesBank(user: JwtPayload, dto: CreateNotesBankDto) {
    return this.prisma.notesBank.create({
      data: {
        title: dto.title,
        createdById: user.sub,
        batches: dto.batchIds?.length ? { create: dto.batchIds.map((batchId) => ({ batchId })) } : undefined,
      },
      include: { batches: { include: { batch: { select: { id: true, name: true } } } }, _count: { select: { notes: true } } },
    });
  }

  async updateNotesBank(id: string, user: JwtPayload, dto: UpdateNotesBankDto) {
    const bank = await this.requireBank(id);
    this.assertOwner(user, bank.createdById);
    return this.prisma.$transaction(async (tx) => {
      if (dto.batchIds) {
        await tx.notesBankBatch.deleteMany({ where: { notesBankId: id } });
        if (dto.batchIds.length) {
          await tx.notesBankBatch.createMany({ data: dto.batchIds.map((batchId) => ({ notesBankId: id, batchId })), skipDuplicates: true });
        }
      }
      return tx.notesBank.update({
        where: { id },
        data: { title: dto.title, published: dto.published },
        include: { batches: { include: { batch: { select: { id: true, name: true } } } }, _count: { select: { notes: true } } },
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

  // ---- Student: notes shared with my batches ----
  async listMyNotes(user: JwtPayload, filters: { q?: string; courseId?: string; chapterId?: string }) {
    const all = await this.prisma.note.findMany({
      where: {
        notesBank: { published: true, batches: { some: { batch: { enrollments: { some: { studentId: user.sub } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        chapter: { select: { id: true, title: true } },
        notesBank: { select: { id: true, title: true } },
      },
    });

    // Filter facets from everything the student can access (so dropdowns stay stable).
    const courseMap = new Map<string, { id: string; title: string }>();
    const chapterMap = new Map<string, { id: string; title: string; courseId: string }>();
    for (const n of all) {
      courseMap.set(n.course.id, n.course);
      if (n.chapter) chapterMap.set(n.chapter.id, { id: n.chapter.id, title: n.chapter.title, courseId: n.course.id });
    }

    const q = filters.q?.trim().toLowerCase();
    const filtered = all.filter(
      (n) =>
        (!q || n.name.toLowerCase().includes(q)) &&
        (!filters.courseId || n.course.id === filters.courseId) &&
        (!filters.chapterId || n.chapter?.id === filters.chapterId),
    );

    const notes = await Promise.all(filtered.map(async (n) => ({ ...n, fileUrl: await this.uploads.presignDownload(n.fileUrl) })));
    return {
      notes,
      courses: [...courseMap.values()].sort((a, b) => a.title.localeCompare(b.title)),
      chapters: [...chapterMap.values()].sort((a, b) => a.title.localeCompare(b.title)),
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
