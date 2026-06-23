import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ForumService } from './forum.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateForumCategoryDto } from './dto/create-forum-category.dto';
import { UpdateForumCategoryDto } from './dto/update-forum-category.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';

@UseGuards(JwtAccessGuard)
@Controller('forum')
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Get('categories')
  listCategories(@CurrentUser() user: JwtPayload) {
    return this.forum.listCategoriesForUser(user);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('admin/categories')
  listCategoriesForAdmin() {
    return this.forum.listCategoriesForAdmin();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('admin/categories/:id')
  getCategoryForAdmin(@Param('id') id: string) {
    return this.forum.getCategoryForAdmin(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('admin/categories')
  createCategory(@CurrentUser() user: JwtPayload, @Body() dto: CreateForumCategoryDto) {
    return this.forum.createCategory(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateForumCategoryDto) {
    return this.forum.updateCategory(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete('admin/categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.forum.deleteCategory(id);
  }

  @Get('threads')
  listThreads(@CurrentUser() user: JwtPayload, @Query('categoryId') categoryId?: string, @Query('search') search?: string) {
    return this.forum.listThreads(user, categoryId, search);
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
