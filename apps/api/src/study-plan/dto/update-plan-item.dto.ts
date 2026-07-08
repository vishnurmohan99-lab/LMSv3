import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PlanItemType } from '../../../generated/prisma/client';

export class UpdatePlanItemDto {
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsEnum(PlanItemType)
  type?: PlanItemType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  resourceKind?: string | null;

  @IsOptional()
  @IsString()
  resourceId?: string | null;

  @IsOptional()
  @IsString()
  courseId?: string | null;
}
