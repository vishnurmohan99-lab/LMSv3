import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateChapterDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsDateString()
  unlockAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  unlockAfterDays?: number;
}
