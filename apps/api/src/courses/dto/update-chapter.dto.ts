import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateChapterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsDateString()
  unlockAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  unlockAfterDays?: number | null;
}
