import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StudyPlanService } from './study-plan.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreatePlanItemDto } from './dto/create-plan-item.dto';
import { UpdatePlanItemDto } from './dto/update-plan-item.dto';

@UseGuards(JwtAccessGuard)
@Controller()
export class StudyPlanController {
  constructor(private readonly plan: StudyPlanService) {}

  // Batch plan (faculty who owns the batch, or admin)
  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Get('batches/:batchId/plan')
  listBatchPlan(@Param('batchId') batchId: string, @CurrentUser() user: JwtPayload) {
    return this.plan.listBatchPlan(batchId, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post('batches/:batchId/plan')
  createBatchItem(@Param('batchId') batchId: string, @Body() dto: CreatePlanItemDto, @CurrentUser() user: JwtPayload) {
    return this.plan.createBatchItem(batchId, user, dto);
  }

  // Student merged plan
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  @Get('plan/mine')
  mine(@CurrentUser() user: JwtPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.plan.listMyPlan(user, from, to);
  }

  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  @Post('plan/mine')
  createMine(@Body() dto: CreatePlanItemDto, @CurrentUser() user: JwtPayload) {
    return this.plan.createMyItem(user, dto);
  }

  // Update / delete a plan item (owner-checked in the service)
  @Patch('plan-items/:id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanItemDto, @CurrentUser() user: JwtPayload) {
    return this.plan.updateItem(id, user, dto);
  }

  @Delete('plan-items/:id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.plan.deleteItem(id, user);
  }
}
