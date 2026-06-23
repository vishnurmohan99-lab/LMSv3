import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CourseType, DripType, CompletionRule } from '../../../generated/prisma/client';

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

  @IsOptional()
  @IsEnum(DripType)
  dripType?: DripType;

  @IsOptional()
  @IsEnum(CompletionRule)
  completionRule?: CompletionRule;
}
