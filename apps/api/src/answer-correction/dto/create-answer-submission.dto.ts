import { IsString, MinLength } from 'class-validator';

export class CreateAnswerSubmissionDto {
  @IsString()
  @MinLength(1)
  questionId: string;

  @IsString()
  @MinLength(1)
  fileKey: string; // R2 key from POST /uploads/presign

  @IsString()
  @MinLength(1)
  fileType: string; // mime type
}
