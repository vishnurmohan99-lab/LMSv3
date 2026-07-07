import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { NotesService } from './notes.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateNotesBankDto } from './dto/create-notes-bank.dto';
import { UpdateNotesBankDto } from './dto/update-notes-bank.dto';
import { CreateNoteDto } from './dto/create-note.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('FACULTY', 'ADMIN')
@Controller('notes-banks')
export class NotesBanksController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.notes.listNotesBanks(user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notes.getNotesBank(id, user);
  }

  @Post()
  create(@Body() dto: CreateNotesBankDto, @CurrentUser() user: JwtPayload) {
    return this.notes.createNotesBank(user, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNotesBankDto, @CurrentUser() user: JwtPayload) {
    return this.notes.updateNotesBank(id, user, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.notes.deleteNotesBank(id, user);
  }

  @Post(':id/notes')
  createNote(@Param('id') id: string, @Body() dto: CreateNoteDto, @CurrentUser() user: JwtPayload) {
    return this.notes.createNote(id, user, dto);
  }
}
