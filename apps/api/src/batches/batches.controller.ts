import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BatchesService } from './batches.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { BulkEnrollDto } from './dto/bulk-enroll.dto';
import { ExtendBatchDto } from './dto/extend-batch.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Controller()
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Roles('ADMIN')
  @Get('batches')
  list(@Query('segmentId') segmentId?: string, @Query('subsegmentId') subsegmentId?: string) {
    return this.batchesService.listAllBatches(segmentId, subsegmentId);
  }

  @Roles('ADMIN')
  @Post('batches')
  create(@Body() dto: CreateBatchDto) {
    return this.batchesService.createBatch(dto);
  }

  @Roles('FACULTY')
  @Get('batches/mine')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.batchesService.listBatchesForFaculty(user.sub);
  }

  @Roles('ADMIN')
  @Get('batches/stats')
  stats() {
    return this.batchesService.getStats();
  }

  @Roles('ADMIN', 'FACULTY')
  @Get('batches/:id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.batchesService.getBatch(id, user);
  }

  @Roles('ADMIN')
  @Patch('batches/:id')
  update(@Param('id') id: string, @Body() dto: UpdateBatchDto) {
    return this.batchesService.updateBatch(id, dto);
  }

  @Roles('ADMIN')
  @Delete('batches/:id')
  remove(@Param('id') id: string) {
    return this.batchesService.deleteBatch(id);
  }

  @Roles('ADMIN')
  @Post('batches/:id/extend')
  extend(@Param('id') id: string, @Body() dto: ExtendBatchDto) {
    return this.batchesService.extendBatch(id, dto.newEndDate);
  }

  @Roles('ADMIN')
  @Post('batches/:id/enroll')
  enroll(@Param('id') id: string, @Body() dto: EnrollStudentDto) {
    return this.batchesService.enrollStudent(id, dto.studentId);
  }

  @Roles('ADMIN')
  @Post('batches/:id/enroll/bulk')
  bulkEnroll(@Param('id') id: string, @Body() dto: BulkEnrollDto, @CurrentUser() user: JwtPayload) {
    return this.batchesService.bulkEnroll(id, user, dto.studentIds);
  }

  @Roles('ADMIN')
  @Post('batches/:id/enroll/csv')
  @UseInterceptors(FileInterceptor('file'))
  enrollCsv(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: JwtPayload) {
    return this.batchesService.enrollFromCsv(id, user, file.buffer);
  }

  @Roles('ADMIN')
  @Delete('batches/:id/enroll/:studentId')
  unenroll(@Param('id') id: string, @Param('studentId') studentId: string) {
    return this.batchesService.unenrollStudent(id, studentId);
  }
}
