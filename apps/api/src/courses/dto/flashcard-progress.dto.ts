import { IsEnum } from 'class-validator';
import { FlashcardStatus } from '../../../generated/prisma/client';

export class FlashcardProgressDto {
  @IsEnum(FlashcardStatus)
  status: FlashcardStatus;
}
