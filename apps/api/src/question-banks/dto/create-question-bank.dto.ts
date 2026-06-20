import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateQuestionBankDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;
}
