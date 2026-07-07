import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { CourseType, DripType, CompletionRule } from '../../../generated/prisma/client';

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000000)
  priceCents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  durationMinutes?: number | null;

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
