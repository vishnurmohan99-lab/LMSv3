import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateNotesBankDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  batchIds?: string[];
}
