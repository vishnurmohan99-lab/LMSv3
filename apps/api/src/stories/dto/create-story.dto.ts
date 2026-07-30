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

/** One of the three BEFORE / AFTER / TOOK cells in the viewer's context pane. */
export class StoryStatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  label: string;

  @IsString()
  @MinLength(1)
  @MaxLength(12)
  value: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  unit?: string;
}

export class CreateStoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  studentName: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  avatarInitials?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  /** Required by the design — the card is not allowed to exist without a number. */
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  resultChip: string;

  @IsString()
  @MinLength(1)
  videoKey: string;

  @IsString()
  @MinLength(1)
  posterKey: string;

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

  @IsString()
  @MinLength(1)
  @MaxLength(400)
  quote: string;

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
  courseId?: string;

  /** Visible LMS-wide, bypassing the segment join. */
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
  publishAt?: string;

  /** Omit for evergreen. */
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
