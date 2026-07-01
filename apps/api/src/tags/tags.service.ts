import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
  }

  /** Global upsert-by-name so a tag created anywhere is reusable everywhere. */
  create(name: string) {
    const trimmed = name.trim();
    return this.prisma.tag.upsert({ where: { name: trimmed }, create: { name: trimmed }, update: {} });
  }
}
