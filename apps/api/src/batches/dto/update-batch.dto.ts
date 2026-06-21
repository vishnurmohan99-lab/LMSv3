import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { BatchStatus } from '../../../generated/prisma/client';

export class UpdateBatchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  facultyId?: string;
}
