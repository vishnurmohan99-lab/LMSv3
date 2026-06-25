import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateTodoDto {
  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  text!: string;
}
