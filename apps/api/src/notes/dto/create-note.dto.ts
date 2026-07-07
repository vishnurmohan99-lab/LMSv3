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

  @IsString()
  courseId: string;

  @IsOptional()
  @IsString()
  chapterId?: string;
}
