import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
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
  getAdminReport() {
    return this.reports.getAdminReport();
  }

  @Roles('FACULTY')
  @Get('faculty')
  getFacultyReport(@CurrentUser() user: JwtPayload) {
    return this.reports.getFacultyReport(user);
  }
}
