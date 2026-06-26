import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ForbiddenPointPenaltyType } from '../../../generated/prisma/client';

export class AnswerQuestionPointInputDto {
  @IsString()
  @MinLength(1)
  text: string;

  @IsNumber()
  @Min(0)
  marks: number;
}

export class AnswerQuestionGroupPointInputDto {
  @IsString()
  @MinLength(1)
  text: string;
}

export class AnswerQuestionGroupInputDto {
  @IsInt()
  @Min(1)
  minRequired: number;

  @IsNumber()
  @Min(0)
  marks: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerQuestionGroupPointInputDto)
  points: AnswerQuestionGroupPointInputDto[];
}

export class AnswerQuestionPartInputDto {
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
  marks: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerQuestionPointInputDto)
  mustInclude: AnswerQuestionPointInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerQuestionGroupInputDto)
  groups: AnswerQuestionGroupInputDto[];
}

export class AnswerQuestionForbiddenPointInputDto {
  @IsString()
  @MinLength(1)
  text: string;

  @IsString()
  @MinLength(1)
  category: string;

  @IsEnum(ForbiddenPointPenaltyType)
  penaltyType: ForbiddenPointPenaltyType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  penalty?: number;
}

export class CreateAnswerQuestionDto {
  @IsString()
  @MinLength(1)
  text: string;

  @IsOptional()
  @IsString()
  directive?: string;

  @IsNumber()
  @Min(0)
  maxMarks: number;

  @IsString()
  typeId: string;

  @IsString()
  @MinLength(1)
  modelAnswer: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerQuestionPartInputDto)
  parts: AnswerQuestionPartInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerQuestionForbiddenPointInputDto)
  forbiddenPoints?: AnswerQuestionForbiddenPointInputDto[];

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
