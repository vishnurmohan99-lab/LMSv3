import { Module } from '@nestjs/common';
import { NotesService } from './notes.service';
import { NotesBanksController } from './notes-banks.controller';
import { NotesController } from './notes.controller';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  controllers: [NotesBanksController, NotesController],
  providers: [NotesService],
})
export class NotesModule {}
