import { BadRequestException, Injectable } from '@nestjs/common';

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
}
