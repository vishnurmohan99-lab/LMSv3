import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTagDto } from './dto/create-tag.dto';

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
}
