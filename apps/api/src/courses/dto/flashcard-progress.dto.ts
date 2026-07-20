import { IsEnum, IsOptional } from 'class-validator';
import { FlashcardStatus } from '../../../generated/prisma/client';

export enum FlashcardGradeDto {
  AGAIN = 'AGAIN',
  HARD = 'HARD',
  GOOD = 'GOOD',
}

export class FlashcardProgressDto {
  /** Preferred: spaced-repetition grade, which schedules the next review. */
  @IsOptional()
  @IsEnum(FlashcardGradeDto)
  grade?: FlashcardGradeDto;

  /** Legacy: set the status directly, without scheduling. */
  @IsOptional()
  @IsEnum(FlashcardStatus)
  status?: FlashcardStatus;
}
