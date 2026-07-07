import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateNotesBankDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  batchIds?: string[];
}
