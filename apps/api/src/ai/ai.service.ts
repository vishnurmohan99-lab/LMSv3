import { BadRequestException, Injectable } from '@nestjs/common';

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
  async complete(prompt: string, opts?: { model?: string }): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('AI generation is not configured (missing OPENROUTER_API_KEY)');
    }
    const model = opts?.model ?? process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-20b:free';

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
  async completeVision(prompt: string, imageDataUri: string, opts?: { model?: string }): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('AI generation is not configured (missing OPENROUTER_API_KEY)');
    }
    const model = opts?.model ?? process.env.OPENROUTER_VISION_MODEL ?? 'nvidia/nemotron-nano-12b-v2-vl:free';

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
        provider: { require_parameters: true },
      }),
    });

    if (!res.ok) {
      throw new BadRequestException(`AI vision request failed (${res.status})`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}
