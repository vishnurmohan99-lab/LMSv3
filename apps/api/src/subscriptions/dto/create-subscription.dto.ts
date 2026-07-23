import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Monthly price in paise. Omit for an unpriced plan — 0 means genuinely free. */
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  /** Plan-card bullets, in display order. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  features?: string[];
}
