import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@UseGuards(JwtAccessGuard)
@Controller()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('batches/:batchId/sessions')
  listForBatch(@Param('batchId') batchId: string, @CurrentUser() user: JwtPayload) {
    return this.sessionsService.listForBatch(batchId, user);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post('batches/:batchId/sessions')
  create(@Param('batchId') batchId: string, @Body() dto: CreateSessionDto, @CurrentUser() user: JwtPayload) {
    return this.sessionsService.createSession(batchId, user, dto);
  }

  @Get('sessions')
  list(
    @CurrentUser() user: JwtPayload,
    @Query('batchId') batchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.sessionsService.listSessions(user, { batchId, from, to });
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Patch('sessions/:id')
  update(@Param('id') id: string, @Body() dto: UpdateSessionDto, @CurrentUser() user: JwtPayload) {
    return this.sessionsService.updateSession(id, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Delete('sessions/:id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.sessionsService.deleteSession(id, user);
  }
}
