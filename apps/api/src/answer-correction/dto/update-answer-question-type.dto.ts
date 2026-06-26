import { ArrayMinSize, IsArray, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AnswerQuestionTypePartDto } from './create-answer-question-type.dto';

export class UpdateAnswerQuestionTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerQuestionTypePartDto)
  parts?: AnswerQuestionTypePartDto[];
}
