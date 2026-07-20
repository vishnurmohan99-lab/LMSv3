import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService, type ReportRange } from './reports.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';

@UseGuards(JwtAccessGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Roles('ADMIN')
  @Get('admin')
  getAdminReport(@Query('range') range?: string) {
    const allowed: ReportRange[] = ['RANGE_30', 'QUARTER', 'YTD', 'ALL'];
    return this.reports.getAdminReport(allowed.includes(range as ReportRange) ? (range as ReportRange) : 'ALL');
  }

  @Roles('FACULTY')
  @Get('faculty')
  getFacultyReport(@CurrentUser() user: JwtPayload) {
    return this.reports.getFacultyReport(user);
  }
}
