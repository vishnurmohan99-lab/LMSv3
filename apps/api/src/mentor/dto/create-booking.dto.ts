import { IsISO8601, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  availabilityId: string;

  @IsISO8601()
  date: string;
}
