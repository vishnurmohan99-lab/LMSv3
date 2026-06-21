import { IsArray } from 'class-validator';

export class SubmitFeedbackResponseDto {
  @IsArray()
  answers: (string | number)[];
}
