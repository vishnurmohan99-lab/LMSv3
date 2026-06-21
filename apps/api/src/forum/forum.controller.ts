import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ForumService } from './forum.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';

@UseGuards(JwtAccessGuard)
@Controller('forum')
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get('categories')
  listCategories() {
    return this.forum.listCategories();
  }

  @Get('threads')
  listThreads(@Query('categoryId') categoryId?: string, @Query('search') search?: string) {
    return this.forum.listThreads(categoryId, search);
  }

  @Get('threads/:id')
  getThread(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.forum.getThread(id, user);
  }

  @Post('threads')
  createThread(@CurrentUser() user: JwtPayload, @Body() dto: CreateThreadDto) {
    return this.forum.createThread(user, dto);
  }

  @Post('threads/:id/posts')
  addPost(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: CreatePostDto) {
    return this.forum.addPost(user, id, dto);
  }

  @Post('threads/:id/like')
  toggleLike(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.forum.toggleLike(user, id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch('threads/:id')
  updateThread(@Param('id') id: string, @Body() dto: UpdateThreadDto) {
    return this.forum.updateThread(id, dto);
  }
}
