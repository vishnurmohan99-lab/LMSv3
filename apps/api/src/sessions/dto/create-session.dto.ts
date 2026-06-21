import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { SessionStatus } from '../../../generated/prisma/client';

export class CreateSessionDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsDateString()
  scheduledAt: string;

  @IsInt()
  @Min(1)
  durationMin: number;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsString()
  lessonId?: string;
}
