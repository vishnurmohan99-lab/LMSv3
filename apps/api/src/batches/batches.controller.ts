import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
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
@Roles('FACULTY', 'ADMIN')
@Controller()
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get('courses/:courseId/batches')
  list(@Param('courseId') courseId: string, @CurrentUser() user: JwtPayload) {
    return this.batchesService.listBatches(courseId, user);
  }

  @Post('courses/:courseId/batches')
  create(@Param('courseId') courseId: string, @Body() dto: CreateBatchDto, @CurrentUser() user: JwtPayload) {
    return this.batchesService.createBatch(courseId, user, dto);
  }

  @Get('batches/stats')
  stats(@CurrentUser() user: JwtPayload) {
    return this.batchesService.getStats(user);
  }

  @Roles('ADMIN')
  @Get('batches')
  listAll() {
    return this.batchesService.listAllBatches();
  }

  @Get('batches/:id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.batchesService.getBatch(id, user);
  }

  @Patch('batches/:id')
  update(@Param('id') id: string, @Body() dto: UpdateBatchDto, @CurrentUser() user: JwtPayload) {
    return this.batchesService.updateBatch(id, user, dto);
  }

  @Delete('batches/:id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.batchesService.deleteBatch(id, user);
  }

  @Post('batches/:id/extend')
  extend(@Param('id') id: string, @Body() dto: ExtendBatchDto, @CurrentUser() user: JwtPayload) {
    return this.batchesService.extendBatch(id, user, dto.newEndDate);
  }

  @Post('batches/:id/enroll')
  enroll(@Param('id') id: string, @Body() dto: EnrollStudentDto, @CurrentUser() user: JwtPayload) {
    return this.batchesService.enrollStudent(id, user, dto.studentId);
  }

  @Post('batches/:id/enroll/bulk')
  bulkEnroll(@Param('id') id: string, @Body() dto: BulkEnrollDto, @CurrentUser() user: JwtPayload) {
    return this.batchesService.bulkEnroll(id, user, dto.studentIds);
  }

  @Post('batches/:id/enroll/csv')
  @UseInterceptors(FileInterceptor('file'))
  enrollCsv(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: JwtPayload) {
    return this.batchesService.enrollFromCsv(id, user, file.buffer);
  }

  @Delete('batches/:id/enroll/:studentId')
  unenroll(@Param('id') id: string, @Param('studentId') studentId: string, @CurrentUser() user: JwtPayload) {
    return this.batchesService.unenrollStudent(id, user, studentId);
  }
}
