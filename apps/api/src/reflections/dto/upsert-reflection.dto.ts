import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpsertReflectionDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  wentWell?: string;

  @IsOptional()
  @IsString()
  toImprove?: string;
}
