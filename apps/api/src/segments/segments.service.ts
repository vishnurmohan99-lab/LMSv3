import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { CreateSubsegmentDto } from './dto/create-subsegment.dto';
import { UpdateSubsegmentDto } from './dto/update-subsegment.dto';
import { withUniqueNameCheck } from '../common/unique-violation';

@Injectable()
export class SegmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  async listSegments() {
    const segments = await this.prisma.segment.findMany({
      orderBy: { order: 'asc' },
      include: {
        subsegments: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { courses: true } } },
        },
        _count: { select: { courses: true } },
      },
    });
    return Promise.all(
      segments.map(async (segment) => ({
        ...segment,
        bannerUrl: segment.bannerUrl ? await this.uploads.presignDownload(segment.bannerUrl) : null,
      })),
    );
  }

  async getSegment(id: string) {
    const segment = await this.prisma.segment.findUnique({
      where: { id },
      include: {
        subsegments: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { courses: true } } },
        },
        _count: { select: { courses: true } },
      },
    });
    if (!segment) throw new NotFoundException('Segment not found');
    return {
      ...segment,
      bannerUrl: segment.bannerUrl ? await this.uploads.presignDownload(segment.bannerUrl) : null,
    };
  }

  createSegment(dto: CreateSegmentDto) {
    return withUniqueNameCheck(
      () => this.prisma.segment.create({ data: { name: dto.name, order: dto.order ?? 0, bannerUrl: dto.bannerUrl } }),
      'segment',
    );
  }

  async updateSegment(id: string, dto: UpdateSegmentDto) {
    await this.requireSegment(id);
    return withUniqueNameCheck(() => this.prisma.segment.update({ where: { id }, data: dto }), 'segment');
  }

  async deleteSegment(id: string) {
    await this.requireSegment(id);
    await this.prisma.segment.delete({ where: { id } });
    return { success: true };
  }

  async createSubsegment(segmentId: string, dto: CreateSubsegmentDto) {
    await this.requireSegment(segmentId);
    return withUniqueNameCheck(
      () => this.prisma.subsegment.create({ data: { name: dto.name, order: dto.order ?? 0, segmentId } }),
      'subsegment',
    );
  }

  async updateSubsegment(id: string, dto: UpdateSubsegmentDto) {
    await this.requireSubsegment(id);
    return withUniqueNameCheck(() => this.prisma.subsegment.update({ where: { id }, data: dto }), 'subsegment');
  }

  async deleteSubsegment(id: string) {
    await this.requireSubsegment(id);
    await this.prisma.subsegment.delete({ where: { id } });
    return { success: true };
  }

  async requireSegment(id: string) {
    const segment = await this.prisma.segment.findUnique({ where: { id } });
    if (!segment) throw new NotFoundException('Segment not found');
    return segment;
  }

  async requireSubsegment(id: string) {
    const subsegment = await this.prisma.subsegment.findUnique({ where: { id } });
    if (!subsegment) throw new NotFoundException('Subsegment not found');
    return subsegment;
  }
}
