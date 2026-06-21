import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateThreadDto {
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}
