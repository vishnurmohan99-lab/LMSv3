import { IsArray, IsISO8601, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { NoteScope } from '../../../generated/prisma/client';

export class CreateNotesBankDto {
  @IsString()
  @MinLength(2)
  title: string;

  // Optional so pre-v2 clients that only send { title, batchIds } keep working — the service
  // defaults them to BATCH, which is what they always meant.
  @IsOptional()
  @IsEnum(NoteScope)
  scope?: NoteScope;

  @IsOptional()
  @IsISO8601()
  sessionDate?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  batchIds?: string[];
}
