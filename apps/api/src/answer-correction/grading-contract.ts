export interface TranscriptLine {
  lineId: number;
  text: string; // verbatim, including learner's spelling/grammar errors
}

export interface PresentPoint {
  pointId: string;
  text: string; // the admin's expected point text
  credit: 'full' | 'partial';
  learnerPhrasing: string;
  lineIds: number[];
}

export interface MissingPoint {
  pointId: string;
  text: string;
  marksLost: number; // computed in code from rubric weight, not invented by LLM
  whyItMatters: string;
  suggestedAddition: string;
}

export interface PartResult {
  partId: string;
  partKey: string;
  name: string;
  marksAwarded: number; // computed in code
  marksMax: number;
  detected: boolean;
  presentPoints: PresentPoint[];
  missingPoints: MissingPoint[];
  partComment: string;
}

export interface ForbiddenHit {
  forbiddenPointId: string;
  text: string;
  category: string;
  penaltyType: 'NUMERIC' | 'FLAG_HARD';
  penalty: number;
  lineIds: number[];
  whyItCosts: string;
}

export interface BonusPoint {
  text: string;
  lineIds: number[];
}

/** Raw shape the vision LLM call must return (before our code recomputes marks deterministically). */
export interface LlmGradingResponse {
  transcript: TranscriptLine[];
  partDetections: {
    partId: string;
    detected: boolean;
    partComment: string;
    pointDetections: {
      pointId: string;
      status: 'present' | 'partial' | 'absent';
      learnerPhrasing?: string;
      lineIds?: number[];
      whyItMatters?: string;
      suggestedAddition?: string;
    }[];
  }[];
  forbiddenDetections: {
    forbiddenPointId: string;
    found: boolean;
    lineIds?: number[];
    whyItCosts?: string;
  }[];
  bonusPoints: BonusPoint[];
  upgradedAnswer: string;
  verdict: string;
}

export interface ManualGrade {
  marksAwarded: number;
  comment: string | null;
  gradedByName: string;
  gradedAt: string;
}

/** Final, code-computed contract persisted to AnswerEvaluation and returned to the client. */
export interface GradingResult {
  submissionId: string;
  questionId: string;
  typeId: string;
  transcript: TranscriptLine[];
  overall: { marks: number; max: number; verdict: string };
  parts: PartResult[];
  forbiddenFound: ForbiddenHit[];
  bonusPoints: BonusPoint[];
  modelAnswerRef: string;
  upgradedAnswer: string;
  manualGrade: ManualGrade | null;
}
