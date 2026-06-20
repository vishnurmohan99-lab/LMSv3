import { IsArray, IsOptional, IsString } from 'class-validator';

export class ImportQuestionsDto {
  @IsString()
  questionBankId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questionIds?: string[];
}
