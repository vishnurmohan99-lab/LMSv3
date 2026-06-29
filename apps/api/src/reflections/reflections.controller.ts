import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ReflectionsService } from './reflections.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { UpsertReflectionDto } from './dto/upsert-reflection.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Controller('reflections')
export class ReflectionsController {
  constructor(private readonly reflections: ReflectionsService) {}

  @Roles('STUDENT')
  @Post()
  upsertMine(@CurrentUser() user: JwtPayload, @Body() dto: UpsertReflectionDto) {
    return this.reflections.upsertMine(user, dto);
  }

  @Roles('STUDENT')
  @Get('me')
  listMine(@CurrentUser() user: JwtPayload, @Query('days') days?: string) {
    return this.reflections.listMine(user, days ? Number(days) : undefined);
  }

  @Roles('ADMIN')
  @Get()
  listAll(@Query('studentId') studentId?: string) {
    return this.reflections.listAllForAdmin(studentId);
  }
}
