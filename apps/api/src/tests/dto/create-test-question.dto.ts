import { IsArray, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { QuestionType } from '../../../generated/prisma/client';

export class CreateTestQuestionDto {
  @IsEnum(QuestionType)
  type: QuestionType;

  @IsString()
  @MinLength(1)
  prompt: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsString()
  correctOption?: string;
}
