import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { LessonType } from '../../../generated/prisma/client';

export class CreateLessonDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsEnum(LessonType)
  type: LessonType;

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
}
