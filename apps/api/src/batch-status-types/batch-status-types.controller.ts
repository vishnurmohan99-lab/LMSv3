import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BatchStatusTypesService } from './batch-status-types.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateBatchStatusTypeDto } from './dto/create-batch-status-type.dto';
import { UpdateBatchStatusTypeDto } from './dto/update-batch-status-type.dto';

@UseGuards(JwtAccessGuard)
@Controller('batch-status-types')
export class BatchStatusTypesController {
  constructor(private readonly batchStatusTypesService: BatchStatusTypesService) {}

  @Get()
  list() {
    return this.batchStatusTypesService.listBatchStatusTypes();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateBatchStatusTypeDto) {
    return this.batchStatusTypesService.createBatchStatusType(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBatchStatusTypeDto) {
    return this.batchStatusTypesService.updateBatchStatusType(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.batchStatusTypesService.deleteBatchStatusType(id);
  }
}
