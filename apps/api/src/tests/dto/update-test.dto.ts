import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { TestPublishMode, TestType } from '../../../generated/prisma/client';

export class UpdateTestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsEnum(TestType)
  type?: TestType;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsEnum(TestPublishMode)
  publishMode?: TestPublishMode;

  @IsOptional()
  @IsDateString()
  availableFrom?: string | null;

  @IsOptional()
  @IsDateString()
  availableUntil?: string | null;

  @IsOptional()
  @IsInt()
  durationMinutes?: number | null;

  @IsOptional()
  @IsString()
  chapterId?: string | null;

  @IsOptional()
  @IsString()
  courseId?: string | null;

  @IsOptional()
  @IsString()
  segmentId?: string | null;

  @IsOptional()
  @IsString()
  subsegmentId?: string | null;
}
