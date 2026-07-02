import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { questions: true, testQuestions: true } } },
    });
  }

  /** Global upsert-by-name so a tag created anywhere is reusable everywhere. */
  create(name: string) {
    const trimmed = name.trim();
    return this.prisma.tag.upsert({ where: { name: trimmed }, create: { name: trimmed }, update: {} });
  }

  async rename(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Tag name is required');
    await this.requireTag(id);
    const clash = await this.prisma.tag.findUnique({ where: { name: trimmed } });
    if (clash && clash.id !== id) throw new ConflictException('A tag with that name already exists — merge into it instead');
    return this.prisma.tag.update({ where: { id }, data: { name: trimmed } });
  }

  async remove(id: string) {
    await this.requireTag(id);
    // The implicit m2m relation rows are dropped automatically when the tag is deleted.
    await this.prisma.tag.delete({ where: { id } });
    return { success: true };
  }

  /** Fold `sourceId` into `targetId`: reassign every question/test-question to the target, then delete the source. */
  async merge(sourceId: string, targetId: string) {
    if (sourceId === targetId) throw new BadRequestException('Cannot merge a tag into itself');
    await this.requireTag(sourceId);
    await this.requireTag(targetId);
    await this.prisma.$transaction(
      async (tx) => {
        const questions = await tx.question.findMany({ where: { tags: { some: { id: sourceId } } }, select: { id: true } });
        for (const q of questions) {
          await tx.question.update({ where: { id: q.id }, data: { tags: { connect: { id: targetId }, disconnect: { id: sourceId } } } });
        }
        const testQuestions = await tx.testQuestion.findMany({ where: { tags: { some: { id: sourceId } } }, select: { id: true } });
        for (const q of testQuestions) {
          await tx.testQuestion.update({ where: { id: q.id }, data: { tags: { connect: { id: targetId }, disconnect: { id: sourceId } } } });
        }
        await tx.tag.delete({ where: { id: sourceId } });
      },
      { maxWait: 15000, timeout: 15000 },
    );
    return this.prisma.tag.findUnique({ where: { id: targetId }, include: { _count: { select: { questions: true, testQuestions: true } } } });
  }

  private async requireTag(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }
}
