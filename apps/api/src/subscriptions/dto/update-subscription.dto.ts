import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
