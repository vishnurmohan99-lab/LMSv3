import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';

@UseGuards(JwtAccessGuard)
@Controller()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('search')
  run(@CurrentUser() user: JwtPayload, @Query('q') q?: string) {
    return this.search.search(user, q ?? '');
  }
}
