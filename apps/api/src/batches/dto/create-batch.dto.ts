import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { BatchStatus } from '../../../generated/prisma/client';

export class CreateBatchDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  facultyId?: string;
}
