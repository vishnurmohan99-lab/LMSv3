import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectStoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
