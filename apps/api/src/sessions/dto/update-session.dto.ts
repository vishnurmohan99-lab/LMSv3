import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { SessionStatus } from '../../../generated/prisma/client';

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMin?: number;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsOptional()
  @IsDateString()
  actualStartAt?: string;

  @IsOptional()
  @IsDateString()
  actualEndAt?: string;
}
