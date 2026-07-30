import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  fileUrl: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  // Legacy per-file targeting. Optional now that the bank carries the audience; the service
  // ignores it for scoping and keeps it only so old clients don't break.
  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  chapterId?: string;
}
