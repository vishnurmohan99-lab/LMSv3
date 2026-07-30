import { IsArray, IsBoolean, IsISO8601, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { NoteScope } from '../../../generated/prisma/client';

export class UpdateNotesBankDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsEnum(NoteScope)
  scope?: NoteScope;

  // null clears the date; omitting it leaves the stored one alone.
  @IsOptional()
  @IsISO8601()
  sessionDate?: string | null;

  @IsOptional()
  @IsString()
  courseId?: string | null;

  @IsOptional()
  @IsString()
  lessonId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  batchIds?: string[];
}
