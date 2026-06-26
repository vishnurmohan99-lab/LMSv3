import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GradeAnswerSubmissionDto {
  @IsNumber()
  @Min(0)
  marksAwarded: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
