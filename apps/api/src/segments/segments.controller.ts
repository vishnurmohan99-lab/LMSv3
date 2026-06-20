import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SegmentsService } from './segments.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { CreateSubsegmentDto } from './dto/create-subsegment.dto';

@UseGuards(JwtAccessGuard)
@Controller('segments')
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Get()
  list() {
    return this.segmentsService.listSegments();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.segmentsService.getSegment(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateSegmentDto) {
    return this.segmentsService.createSegment(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSegmentDto) {
    return this.segmentsService.updateSegment(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.segmentsService.deleteSegment(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post(':id/subsegments')
  createSubsegment(@Param('id') id: string, @Body() dto: CreateSubsegmentDto) {
    return this.segmentsService.createSubsegment(id, dto);
  }
}
