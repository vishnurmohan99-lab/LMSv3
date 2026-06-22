import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBatchDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  facultyId?: string;

  @IsOptional()
  @IsString()
  segmentId?: string;

  @IsOptional()
  @IsString()
  subsegmentId?: string;
}
