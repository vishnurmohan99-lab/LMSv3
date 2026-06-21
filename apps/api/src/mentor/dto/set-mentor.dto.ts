import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetMentorDto {
  @IsBoolean()
  isMentor: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialty?: string;
}
