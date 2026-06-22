import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  segmentId?: string | null;

  @IsOptional()
  @IsString()
  subsegmentId?: string | null;
}
