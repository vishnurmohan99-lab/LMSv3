import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { MergeTagDto } from './dto/merge-tag.dto';

@UseGuards(JwtAccessGuard)
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  // Any authenticated user can read the tag list (used by question/test-builder pickers).
  @Get()
  list() {
    return this.tags.list();
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.tags.create(dto.name);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Patch(':id')
  rename(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.tags.rename(id, dto.name);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Post(':id/merge')
  merge(@Param('id') id: string, @Body() dto: MergeTagDto) {
    return this.tags.merge(id, dto.targetId);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tags.remove(id);
  }
}
