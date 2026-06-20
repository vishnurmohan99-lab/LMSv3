import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSegmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
