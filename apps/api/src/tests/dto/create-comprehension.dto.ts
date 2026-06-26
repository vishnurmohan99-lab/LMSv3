import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType } from '../../../generated/prisma/client';

class ComprehensionQuestionDto {
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsString()
  @MinLength(1)
  prompt: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsString()
  correctOption: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class CreateComprehensionDto {
  @IsString()
  @MinLength(1)
  passageText: string;

  @IsOptional()
  @IsString()
  passageImageUrl?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ComprehensionQuestionDto)
  questions: ComprehensionQuestionDto[];
}
