import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CourseType, DripType } from '../../../generated/prisma/client';

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

  @IsOptional()
  @IsEnum(DripType)
  dripType?: DripType;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
