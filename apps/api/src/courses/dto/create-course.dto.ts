import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { CourseType, CourseDifficulty, DripType, CompletionRule } from '../../../generated/prisma/client';

export class CreateCourseDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000000)
  priceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  durationMinutes?: number;

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
  @IsEnum(CourseDifficulty)
  difficulty?: CourseDifficulty;

  @IsOptional()
  @IsEnum(DripType)
  dripType?: DripType;

  @IsOptional()
  @IsEnum(CompletionRule)
  completionRule?: CompletionRule;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
