import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTodoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  text?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
