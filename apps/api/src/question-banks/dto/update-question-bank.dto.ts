import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateQuestionBankDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
