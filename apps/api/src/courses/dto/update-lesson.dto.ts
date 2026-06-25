import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { LessonType } from '../../../generated/prisma/client';

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsEnum(LessonType)
  type?: LessonType;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsString()
  contentUrl?: string;

  @IsOptional()
  @IsDateString()
  liveAt?: string;

  @IsOptional()
  @IsBoolean()
  flashcardsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  aiNotesEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  askMeEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  summaryDeckEnabled?: boolean;

  @IsOptional()
  @IsString()
  transcript?: string;
}
