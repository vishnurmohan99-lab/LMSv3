import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { FeedbackAssignType, FeedbackTargetType } from '../../../generated/prisma/client';

class FeedbackQuestionDto {
  @IsIn(['RATING', 'TEXT'])
  type: 'RATING' | 'TEXT';

  @IsString()
  @MinLength(1)
  label: string;
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
