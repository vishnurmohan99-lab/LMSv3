import { Controller, Param, Post, UseGuards, Get } from '@nestjs/common';
import { BulkOperationsService } from './bulk-operations.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';

@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('FACULTY', 'ADMIN')
@Controller()
export class BulkOperationsController {
  constructor(private readonly bulkOperationsService: BulkOperationsService) {}

  @Get('batches/:batchId/bulk-operations')
  listForBatch(@Param('batchId') batchId: string, @CurrentUser() user: JwtPayload) {
    return this.bulkOperationsService.listForBatch(batchId, user);
  }

  @Post('bulk-operations/:id/undo')
  undo(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.bulkOperationsService.undo(id, user);
  }
}
