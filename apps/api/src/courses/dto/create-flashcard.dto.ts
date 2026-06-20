import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateFlashcardDto {
  @IsString()
  @MinLength(1)
  front: string;

  @IsString()
  @MinLength(1)
  back: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
