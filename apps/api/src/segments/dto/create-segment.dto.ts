import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSegmentDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsString()
  bannerUrl?: string;
}
