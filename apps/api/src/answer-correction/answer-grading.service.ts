import { BadRequestException, Injectable } from '@nestjs/common';
import { AiService, extractFirstJsonValue } from '../ai/ai.service';
import { UploadsService } from '../uploads/uploads.service';
import { Prisma } from '../../generated/prisma/client';
import { GradingResult, LlmGradingResponse, PartResult, PresentPoint, MissingPoint } from './grading-contract';

export type AnswerQuestionWithRubric = Prisma.AnswerQuestionGetPayload<{
  include: {
    type: true;
    forbiddenPoints: true;
    parts: { include: { mustIncludePoints: true; groups: { include: { points: true } } } };
  };
}>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class AnswerGradingService {
  constructor(
    private readonly ai: AiService,
    private readonly uploads: UploadsService,
  ) {}

  async gradeSubmission(
    submission: { id: string; fileKey: string; fileType: string },
    question: AnswerQuestionWithRubric,
  ): Promise<GradingResult> {
    if (submission.fileType === 'application/pdf') {
      throw new BadRequestException('PDF support is coming soon -- please upload a photo of your answer for now');
    }

    const buffer = await this.uploads.getObjectBuffer(submission.fileKey);
    const imageDataUri = `data:${submission.fileType};base64,${buffer.toString('base64')}`;

    const prompt = this.buildPrompt(question);
    const llmResponse = await this.completeJsonVisionWithRetry(prompt, imageDataUri);
    this.validateLlmGradingResponse(llmResponse, question);

    const parts: PartResult[] = question.parts.map((part) => {
      const detection = llmResponse.partDetections.find((d) => d.partId === part.id);
      return this.computePartMarks(part, detection);
    });

    const forbiddenFound = question.forbiddenPoints
      .map((fp) => {
        const detection = llmResponse.forbiddenDetections.find((d) => d.forbiddenPointId === fp.id);
        if (!detection?.found) return null;
        return {
          forbiddenPointId: fp.id,
          text: fp.text,
          category: fp.category,
          penaltyType: fp.penaltyType,
          penalty: fp.penalty,
          lineIds: detection.lineIds ?? [],
          whyItCosts: detection.whyItCosts ?? '',
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const numericPenalty = forbiddenFound.filter((f) => f.penaltyType === 'NUMERIC').reduce((s, f) => s + f.penalty, 0);
    const rawTotal = parts.reduce((s, p) => s + p.marksAwarded, 0) - numericPenalty;
    const overallMarks = Math.min(Math.max(round2(rawTotal), 0), question.maxMarks);

    return {
      submissionId: submission.id,
      questionId: question.id,
      typeId: question.typeId,
      transcript: llmResponse.transcript,
      overall: { marks: overallMarks, max: question.maxMarks, verdict: llmResponse.verdict },
      parts,
      forbiddenFound,
      bonusPoints: llmResponse.bonusPoints,
      modelAnswerRef: question.modelAnswer,
      upgradedAnswer: llmResponse.upgradedAnswer,
      manualGrade: null,
    };
  }

  private computePartMarks(part: AnswerQuestionWithRubric['parts'][number], detection: LlmGradingResponse['partDetections'][number] | undefined): PartResult {
    let awarded = 0;
    const presentPoints: PresentPoint[] = [];
    const missingPoints: MissingPoint[] = [];
    const pointDetections = detection?.pointDetections ?? [];

    for (const point of part.mustIncludePoints) {
      const d = pointDetections.find((p) => p.pointId === point.id);
      const credit = d?.status === 'present' ? 1 : d?.status === 'partial' ? 0.5 : 0;
      awarded += credit * point.marks;
      if (credit > 0) {
        presentPoints.push({
          pointId: point.id,
          text: point.text,
          credit: credit === 1 ? 'full' : 'partial',
          learnerPhrasing: d?.learnerPhrasing ?? '',
          lineIds: d?.lineIds ?? [],
        });
      } else {
        missingPoints.push({
          pointId: point.id,
          text: point.text,
          marksLost: point.marks,
          whyItMatters: d?.whyItMatters ?? '',
          suggestedAddition: d?.suggestedAddition ?? '',
        });
      }
    }

    for (const group of part.groups) {
      const perPointMarks = group.points.length > 0 ? group.marks / group.minRequired : 0;
      let creditedInGroup = 0;
      for (const point of group.points) {
        const d = pointDetections.find((p) => p.pointId === point.id);
        const isHit = d?.status === 'present' || d?.status === 'partial';
        if (isHit && creditedInGroup < group.minRequired) {
          creditedInGroup++;
          awarded += perPointMarks * (d?.status === 'partial' ? 0.5 : 1);
          presentPoints.push({
            pointId: point.id,
            text: point.text,
            credit: d?.status === 'partial' ? 'partial' : 'full',
            learnerPhrasing: d?.learnerPhrasing ?? '',
            lineIds: d?.lineIds ?? [],
          });
        } else if (!isHit) {
          missingPoints.push({
            pointId: point.id,
            text: point.text,
            marksLost: 0, // group points are "any N of M" -- not individually weighted when absent
            whyItMatters: d?.whyItMatters ?? '',
            suggestedAddition: d?.suggestedAddition ?? '',
          });
        }
      }
    }

    awarded = Math.min(awarded, part.marks);
    return {
      partId: part.id,
      partKey: part.partKey,
      name: part.name,
      marksAwarded: round2(awarded),
      marksMax: part.marks,
      detected: detection?.detected ?? false,
      presentPoints,
      missingPoints,
      partComment: detection?.partComment ?? '',
    };
  }

  private buildPrompt(question: AnswerQuestionWithRubric): string {
    const partsSpec = question.parts.map((part) => ({
      partId: part.id,
      name: part.name,
      marks: part.marks,
      mustInclude: part.mustIncludePoints.map((p) => ({ pointId: p.id, text: p.text, marks: p.marks })),
      groups: part.groups.map((g) => ({ groupId: g.id, minRequired: g.minRequired, marks: g.marks, points: g.points.map((p) => ({ pointId: p.id, text: p.text })) })),
    }));
    const forbiddenSpec = question.forbiddenPoints.map((f) => ({ forbiddenPointId: f.id, text: f.text, category: f.category }));

    return `You are an expert examiner grading a handwritten answer. Transcribe the handwriting VERBATIM, preserving the learner's own spelling/grammar errors -- never silently correct their mistakes. Then evaluate the answer against the rubric below by MEANING, not by exact keyword matching: a learner who makes the same point with different wording or a different valid example should be credited as "present".

QUESTION: ${question.text}
${question.directive ? `DIRECTIVE: ${question.directive}\n` : ''}MAX MARKS: ${question.maxMarks}

MODEL ANSWER (reference exemplar only -- do NOT diff the learner's answer against it literally):
${question.modelAnswer}

RUBRIC PARTS (segment the learner's answer into these parts; mark a part "detected: false" only if there is truly no content for it):
${JSON.stringify(partsSpec, null, 2)}

FORBIDDEN POINTS (flag if the learner's answer contains any of these):
${JSON.stringify(forbiddenSpec, null, 2)}

Respond with ONLY a JSON object, no markdown, no commentary, in this EXACT shape:
{
  "transcript": [{"lineId": 1, "text": "..."}],
  "partDetections": [{
    "partId": "<id from RUBRIC PARTS>",
    "detected": true,
    "partComment": "short comment on this part",
    "pointDetections": [{
      "pointId": "<a mustInclude or group point id from RUBRIC PARTS>",
      "status": "present" | "partial" | "absent",
      "learnerPhrasing": "the learner's actual words proving this point (if present/partial)",
      "lineIds": [1],
      "whyItMatters": "required if status is partial or absent",
      "suggestedAddition": "required if status is partial or absent"
    }]
  }],
  "forbiddenDetections": [{"forbiddenPointId": "<id from FORBIDDEN POINTS>", "found": false, "lineIds": [], "whyItCosts": "required if found is true"}],
  "bonusPoints": [{"text": "a valid point the learner made that wasn't on the rubric", "lineIds": [1]}],
  "upgradedAnswer": "the learner's answer, minimally edited to a full-marks standard, keeping their own points",
  "verdict": "1-2 sentence overall judgment"
}

You MUST include a pointDetections entry for EVERY point id listed in every part (mustInclude and group points), and a forbiddenDetections entry for EVERY forbidden point id, even if absent/not found.`;
  }

  private async completeJsonVisionWithRetry(prompt: string, imageDataUri: string): Promise<LlmGradingResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.ai.completeVision(prompt, imageDataUri, 'ANSWER_GRADING');
        const jsonText = extractFirstJsonValue(raw, '{', '}');
        if (!jsonText) throw new Error('No JSON object found in AI response');
        return JSON.parse(jsonText) as LlmGradingResponse;
      } catch (err) {
        lastError = err;
      }
    }
    throw new BadRequestException(`AI grading failed: ${lastError instanceof Error ? lastError.message : 'unknown error'}`);
  }

  /** Structural validation: every rubric id the grader needs to see must appear in the response. */
  private validateLlmGradingResponse(parsed: unknown, question: AnswerQuestionWithRubric): asserts parsed is LlmGradingResponse {
    const r = parsed as Partial<LlmGradingResponse> | null;
    if (!r || typeof r !== 'object') throw new BadRequestException('AI response was not a JSON object');
    if (!Array.isArray(r.transcript)) throw new BadRequestException('AI response missing transcript array');
    if (!Array.isArray(r.partDetections)) throw new BadRequestException('AI response missing partDetections array');
    if (!Array.isArray(r.forbiddenDetections)) throw new BadRequestException('AI response missing forbiddenDetections array');
    if (!Array.isArray(r.bonusPoints)) throw new BadRequestException('AI response missing bonusPoints array');
    if (typeof r.upgradedAnswer !== 'string') throw new BadRequestException('AI response missing upgradedAnswer');
    if (typeof r.verdict !== 'string') throw new BadRequestException('AI response missing verdict');

    for (const part of question.parts) {
      const detection = r.partDetections!.find((d) => d.partId === part.id);
      if (!detection) throw new BadRequestException(`AI response missing partDetections entry for part "${part.name}"`);
      const allPointIds = [...part.mustIncludePoints.map((p) => p.id), ...part.groups.flatMap((g) => g.points.map((p) => p.id))];
      for (const pointId of allPointIds) {
        if (!detection.pointDetections?.some((pd) => pd.pointId === pointId)) {
          throw new BadRequestException(`AI response missing pointDetections entry for point ${pointId} in part "${part.name}"`);
        }
      }
    }
    for (const fp of question.forbiddenPoints) {
      if (!r.forbiddenDetections!.some((d) => d.forbiddenPointId === fp.id)) {
        throw new BadRequestException(`AI response missing forbiddenDetections entry for forbidden point ${fp.id}`);
      }
    }
  }
}
