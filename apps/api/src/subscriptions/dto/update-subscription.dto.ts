import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Monthly price in paise. Null clears it back to unpriced. */
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  features?: string[];
}
