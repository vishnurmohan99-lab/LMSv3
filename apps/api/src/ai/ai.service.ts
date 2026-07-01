import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiFeature, AiProvider } from '../../generated/prisma/client';

const OPENAI_TEXT_DEFAULT = 'gpt-4o-mini';
const OPENAI_VISION_DEFAULT = 'gpt-4o-mini';
const OPENAI_IMAGE_DEFAULT = 'gpt-image-1';

/**
 * Extracts the first balanced JSON array/object from raw AI text, ignoring brackets that
 * appear inside string literals and any commentary before/after. A naive greedy regex
 * (`/\[[\s\S]*\]/`) matches from the first opening bracket to the *last* closing bracket in
 * the whole response, so trailing prose containing brackets corrupts the match — this scans
 * with bracket-depth tracking instead, stopping at the first value that actually balances.
 */
export function extractFirstJsonValue(raw: string, open: '[' | '{', close: ']' | '}'): string | null {
  const start = raw.indexOf(open);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return null;
}

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves which provider+model to call for a given feature, honoring an admin override
   *  (Admin → Settings → AI Models) over the env-var/OpenAI default. */
  private async resolveModel(feature: AiFeature, envDefault: string, openaiDefault: string): Promise<{ provider: AiProvider; model: string }> {
    const setting = await this.prisma.aiFeatureSetting.findUnique({ where: { feature } });
    const provider = setting?.provider ?? 'OPENROUTER';
    const model = setting?.model?.trim() || (provider === 'OPENAI' ? openaiDefault : envDefault);
    return { provider, model };
  }

  private requireOpenAiKey(): string {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('AI generation is not configured (missing OPENAI_API_KEY)');
    }
    return apiKey;
  }

  private requireOpenRouterKey(): string {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('AI generation is not configured (missing OPENROUTER_API_KEY)');
    }
    return apiKey;
  }

  async complete(prompt: string, feature: AiFeature): Promise<string> {
    const { provider, model } = await this.resolveModel(feature, process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-20b:free', OPENAI_TEXT_DEFAULT);

    const apiKey = provider === 'OPENAI' ? this.requireOpenAiKey() : this.requireOpenRouterKey();
    const url = provider === 'OPENAI' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      throw new BadRequestException(`AI request failed (${res.status})`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  /** Multimodal call: text prompt + one image, for the Answer Correction vision grading pipeline. */
  async completeVision(prompt: string, imageDataUri: string, feature: AiFeature): Promise<string> {
    const { provider, model } = await this.resolveModel(
      feature,
      process.env.OPENROUTER_VISION_MODEL ?? 'nvidia/nemotron-nano-12b-v2-vl:free',
      OPENAI_VISION_DEFAULT,
    );

    const apiKey = provider === 'OPENAI' ? this.requireOpenAiKey() : this.requireOpenRouterKey();
    const url = provider === 'OPENAI' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageDataUri } },
            ],
          },
        ],
        ...(provider === 'OPENROUTER' ? { provider: { require_parameters: true } } : {}),
      }),
    });

    if (!res.ok) {
      throw new BadRequestException(`AI vision request failed (${res.status})`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  /**
   * Generates one image from a text prompt, for the Cheat Sheet illustration pipeline.
   * Returns the raw image bytes + detected content type. OpenRouter has no $0 image model, so
   * this is the feature most likely to be switched to OPENAI (gpt-image-1) via the admin panel.
   */
  async generateImage(prompt: string, feature: AiFeature): Promise<{ buffer: Buffer; contentType: string }> {
    const { provider, model } = await this.resolveModel(feature, process.env.OPENROUTER_IMAGE_MODEL ?? 'google/gemini-2.5-flash-image', OPENAI_IMAGE_DEFAULT);

    if (provider === 'OPENAI') {
      const apiKey = this.requireOpenAiKey();
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, prompt, size: '1024x1024' }),
      });

      if (!res.ok) {
        throw new BadRequestException(`AI image generation failed (${res.status})`);
      }

      const data = await res.json();
      const b64: string | undefined = data.data?.[0]?.b64_json;
      if (!b64) {
        throw new BadRequestException('AI image generation did not return an image');
      }
      return { buffer: Buffer.from(b64, 'base64'), contentType: 'image/png' };
    }

    const apiKey = this.requireOpenRouterKey();
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        modalities: ['image', 'text'],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      throw new BadRequestException(`AI image generation failed (${res.status})`);
    }

    const data = await res.json();
    const imageUrl: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl || !imageUrl.startsWith('data:')) {
      throw new BadRequestException('AI image generation did not return an image');
    }

    const match = imageUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!match) {
      throw new BadRequestException('AI image generation returned an unexpected format');
    }
    const [, contentType, base64] = match;
    return { buffer: Buffer.from(base64, 'base64'), contentType };
  }
}
