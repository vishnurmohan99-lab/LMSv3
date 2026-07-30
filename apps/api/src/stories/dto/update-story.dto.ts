import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StoryStatDto } from './create-story.dto';

/**
 * Every create field, all optional — written out rather than derived, matching the other
 * update DTOs in this codebase (@nestjs/mapped-types is not a dependency).
 * Media keys are optional so a metadata-only edit never forces a re-upload.
 */
export class UpdateStoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  studentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  avatarInitials?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  resultChip?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  videoKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  posterKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsEnum(['PORTRAIT', 'LANDSCAPE'])
  orientation?: 'PORTRAIT' | 'LANDSCAPE';

  @IsOptional()
  @IsString()
  captionsVtt?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(400)
  quote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => StoryStatDto)
  stats?: StoryStatDto[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ctaUrl?: string;

  @IsOptional()
  @IsString()
  courseId?: string | null;

  @IsOptional()
  @IsBoolean()
  allSegments?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segmentIds?: string[];

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsISO8601()
  publishAt?: string | null;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;
}
