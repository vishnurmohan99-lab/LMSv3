import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PlanItemType } from '../../../generated/prisma/client';

export class CreatePlanItemDto {
  @IsDateString()
  scheduledFor: string;

  @IsOptional()
  @IsEnum(PlanItemType)
  type?: PlanItemType;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  resourceKind?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;
}
