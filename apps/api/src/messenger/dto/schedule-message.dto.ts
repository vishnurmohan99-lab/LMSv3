import { IsDateString, IsString, MinLength } from 'class-validator';

export class ScheduleMessageDto {
  @IsString()
  conversationId: string;

  @IsString()
  @MinLength(1)
  body: string;

  @IsDateString()
  sendAt: string;
}
