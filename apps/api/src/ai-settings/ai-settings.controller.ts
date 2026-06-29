import { Body, Controller, Get, Param, ParseEnumPipe, Patch, UseGuards } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AiFeature } from '../../generated/prisma/client';
import { UpdateAiSettingDto } from './dto/update-ai-setting.dto';

@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN')
@Controller('ai-settings')
export class AiSettingsController {
  constructor(private readonly aiSettings: AiSettingsService) {}

  @Get()
  listAll() {
    return this.aiSettings.listAll();
  }

  @Patch(':feature')
  upsert(@Param('feature', new ParseEnumPipe(AiFeature)) feature: AiFeature, @Body() dto: UpdateAiSettingDto) {
    return this.aiSettings.upsert(feature, dto);
  }
}
