import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CourseType } from '../../../generated/prisma/client';

export class CreateCourseDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  segmentId?: string;

  @IsOptional()
  @IsString()
  subsegmentId?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsEnum(CourseType)
  type?: CourseType;
}
