import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}
