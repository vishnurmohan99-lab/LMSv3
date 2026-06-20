import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

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
}
