import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBatchStatusTypeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isCompletionTarget?: boolean;
}
