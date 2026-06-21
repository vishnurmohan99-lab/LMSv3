import { IsOptional, IsString } from 'class-validator';

export class SaveAnswerDto {
  @IsString()
  testQuestionId: string;

  @IsOptional()
  @IsString()
  selectedOption?: string;
}
