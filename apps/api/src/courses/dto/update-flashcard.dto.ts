import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateFlashcardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  front?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  back?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
