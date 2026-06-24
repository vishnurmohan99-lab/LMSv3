import { ArrayMinSize, IsArray, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ComprehensionQuestionDto {
  @IsString()
  @MinLength(1)
  prompt: string;

  @IsArray()
  @IsString({ each: true })
  options: string[];

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
