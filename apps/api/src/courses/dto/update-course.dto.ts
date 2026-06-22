import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CourseType } from '../../../generated/prisma/client';

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsString()
  segmentId?: string | null;

  @IsOptional()
  @IsString()
  subsegmentId?: string | null;

  @IsOptional()
  @IsEnum(CourseType)
  type?: CourseType;
}
