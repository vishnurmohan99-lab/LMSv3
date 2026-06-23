import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { FeedbackAssignType, FeedbackTargetType } from '../../../generated/prisma/client';

export const FEEDBACK_QUESTION_TYPES = ['RATING', 'TEXT', 'SHORT_TEXT', 'PARAGRAPH', 'MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'] as const;
export type FeedbackQuestionType = (typeof FEEDBACK_QUESTION_TYPES)[number];

class FeedbackQuestionDto {
  @IsIn(FEEDBACK_QUESTION_TYPES)
  type: FeedbackQuestionType;

  @IsString()
  @MinLength(1)
  label: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class CreateFeedbackFormDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsEnum(FeedbackTargetType)
  targetType: FeedbackTargetType;

  @IsOptional()
  @IsString()
  targetCourseId?: string;

  @IsOptional()
  @IsString()
  targetFacultyId?: string;

  @IsOptional()
  @IsString()
  targetSystemArea?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeedbackQuestionDto)
  questions: FeedbackQuestionDto[];

  @IsEnum(FeedbackAssignType)
  assignType: FeedbackAssignType;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];
}
