import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiFeature, AiProvider } from '../../generated/prisma/client';
import { UpdateAiSettingDto } from './dto/update-ai-setting.dto';

/** Mirrors the env-var defaults in AiService — kept here too so the admin UI can show what a
 *  feature actually falls back to before any override has ever been saved for it. */
const FEATURE_META: Record<AiFeature, { label: string; description: string; defaultModel: string }> = {
  FLASHCARDS: {
    label: 'Flashcard generation',
    description: 'Generates study flashcards from a lesson’s content.',
    defaultModel: process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-20b:free',
  },
  NOTES: {
    label: 'AI Notes generation',
    description: 'Generates the summary + key points shown under video lessons.',
    defaultModel: process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-20b:free',
  },
  SUMMARY_DECK: {
    label: 'Summary Deck generation',
    description: 'Splits a lesson into swipeable summary cards.',
    defaultModel: process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-20b:free',
  },
  CHEAT_SHEET_TEXT: {
    label: 'Cheat Sheet generation (text)',
    description: 'Generates the bullets/table/exam-tip text for each cheat sheet page.',
    defaultModel: process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-20b:free',
  },
  CHEAT_SHEET_IMAGE: {
    label: 'Cheat Sheet illustrations',
    description: 'Generates the flat-style illustration for each cheat sheet page.',
    defaultModel: process.env.OPENROUTER_IMAGE_MODEL ?? 'google/gemini-2.5-flash-image',
  },
  CHAT: {
    label: 'Ask-a-doubt Chat',
    description: 'Answers a student’s question grounded in the current lesson’s content.',
    defaultModel: process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-20b:free',
  },
  ANSWER_GRADING: {
    label: 'Answer Correction grading',
    description: 'Vision model that transcribes + grades a handwritten answer photo against the rubric.',
    defaultModel: process.env.OPENROUTER_VISION_MODEL ?? 'nvidia/nemotron-nano-12b-v2-vl:free',
  },
};

@Injectable()
export class AiSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll() {
    const rows = await this.prisma.aiFeatureSetting.findMany();
    const byFeature = new Map(rows.map((r) => [r.feature, r]));

    return (Object.keys(FEATURE_META) as AiFeature[]).map((feature) => {
      const meta = FEATURE_META[feature];
      const row = byFeature.get(feature);
      return {
        feature,
        label: meta.label,
        description: meta.description,
        provider: row?.provider ?? AiProvider.OPENROUTER,
        model: row?.model ?? null,
        defaultModel: meta.defaultModel,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  upsert(feature: AiFeature, dto: UpdateAiSettingDto) {
    return this.prisma.aiFeatureSetting.upsert({
      where: { feature },
      create: { feature, provider: dto.provider, model: dto.model?.trim() || null },
      update: { provider: dto.provider, model: dto.model?.trim() || null },
    });
  }
}
