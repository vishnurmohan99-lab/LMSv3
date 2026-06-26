import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AnswerQuestionTypePartDto {
  @IsString()
  @MinLength(1)
  partKey: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsNumber()
  @Min(0)
  defaultWeight: number;
}

export class CreateAnswerQuestionTypeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerQuestionTypePartDto)
  parts: AnswerQuestionTypePartDto[];
}
