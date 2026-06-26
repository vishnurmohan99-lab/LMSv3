import { ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AnswerQuestionPartInputDto, AnswerQuestionForbiddenPointInputDto } from './create-answer-question.dto';

export class UpdateAnswerQuestionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  text?: string;

  @IsOptional()
  @IsString()
  directive?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxMarks?: number;

  @IsOptional()
  @IsString()
  typeId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  modelAnswer?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerQuestionPartInputDto)
  parts?: AnswerQuestionPartInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerQuestionForbiddenPointInputDto)
  forbiddenPoints?: AnswerQuestionForbiddenPointInputDto[];

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
