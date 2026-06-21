import { IsDateString } from 'class-validator';

export class ExtendBatchDto {
  @IsDateString()
  newEndDate: string;
}
