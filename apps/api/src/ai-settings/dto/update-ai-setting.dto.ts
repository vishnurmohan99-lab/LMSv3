import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AiProvider } from '../../../generated/prisma/client';

export class UpdateAiSettingDto {
  @IsEnum(AiProvider)
  provider!: AiProvider;

  @IsOptional()
  @IsString()
  model?: string;
}
