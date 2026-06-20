import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { TestPublishMode } from '../../../generated/prisma/client';

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
}
