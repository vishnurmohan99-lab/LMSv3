import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { NotesService } from './notes.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { UpdateNoteDto } from './dto/update-note.dto';

@UseGuards(JwtAccessGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  // Student: notes shared with the batches they're enrolled in.
  @UseGuards(RolesGuard)
  @Roles('STUDENT')
  @Get('mine')
  mine(
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
    @Query('courseId') courseId?: string,
    @Query('chapterId') chapterId?: string,
  ) {
    return this.notes.listMyNotes(user, { q, courseId, chapterId });
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNoteDto, @CurrentUser() user: JwtPayload) {
    return this.notes.updateNote(id, user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('FACULTY', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notes.deleteNote(id, user);
  }
}
