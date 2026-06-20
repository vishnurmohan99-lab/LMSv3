import { Body, Controller, Delete, Param, Patch, UseGuards } from '@nestjs/common';
import { SegmentsService } from './segments.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateSubsegmentDto } from './dto/update-subsegment.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN')
@Controller('subsegments')
export class SubsegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSubsegmentDto) {
    return this.segmentsService.updateSubsegment(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.segmentsService.deleteSubsegment(id);
  }
}
