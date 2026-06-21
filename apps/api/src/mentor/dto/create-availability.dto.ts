import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class CreateAvailabilityDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be in HH:mm format' })
  time: string;
}
