import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StoriesService } from './stories.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { StoryViewDto } from './dto/story-view.dto';
import { RejectStoryDto } from './dto/reject-story.dto';
import { ReorderStoriesDto } from './dto/reorder-stories.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Controller('stories')
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  // ---- student ----
  // Declared before ':id' routes so "feed" is never captured as an id.

  @Roles('STUDENT')
  @Get('feed')
  feed(@CurrentUser() user: JwtPayload) {
    return this.stories.getFeed(user);
  }

  @Roles('STUDENT')
  @Post(':id/view')
  recordView(@Param('id') id: string, @Body() dto: StoryViewDto, @CurrentUser() user: JwtPayload) {
    return this.stories.recordView(id, user, dto);
  }

  @Roles('STUDENT')
  @Post(':id/react')
  react(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.stories.toggleReaction(id, user);
  }

  // ---- authoring ----

  @Roles('FACULTY', 'ADMIN')
  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.stories.listForAuthor(user, status);
  }

  @Roles('FACULTY', 'ADMIN')
  @Post()
  create(@Body() dto: CreateStoryDto, @CurrentUser() user: JwtPayload) {
    return this.stories.create(user, dto);
  }

  @Roles('FACULTY', 'ADMIN')
  @Patch('reorder')
  reorder(@Body() dto: ReorderStoriesDto, @CurrentUser() user: JwtPayload) {
    return this.stories.reorder(user, dto.items);
  }

  @Roles('FACULTY', 'ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStoryDto, @CurrentUser() user: JwtPayload) {
    return this.stories.update(id, user, dto);
  }

  @Roles('FACULTY', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.stories.remove(id, user);
  }

  @Roles('FACULTY', 'ADMIN')
  @Get(':id/analytics')
  analytics(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.stories.analytics(id, user);
  }

  // ---- moderation ----

  @Roles('FACULTY', 'ADMIN')
  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.stories.submit(id, user);
  }

  /** Approving publishes a claim about a real person — admins only. */
  @Roles('ADMIN')
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.stories.approve(id, user);
  }

  @Roles('ADMIN')
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectStoryDto, @CurrentUser() user: JwtPayload) {
    return this.stories.reject(id, user, dto.reason);
  }

  @Roles('FACULTY', 'ADMIN')
  @Post(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.stories.archive(id, user);
  }
}
