"use client";

import { useState } from "react";
import type { AnswerGradingResult } from "@/lib/api";

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--rl)",
  padding: 20,
  marginBottom: 16,
};

function scoreColor(pct: number) {
  if (pct >= 0.7) return { bg: "var(--green-soft)", fg: "var(--green)" };
  if (pct >= 0.4) return { bg: "var(--amber-soft)", fg: "var(--amber)" };
  return { bg: "var(--red-soft)", fg: "var(--red)" };
}

export default function EvaluationResult({ result }: { result: AnswerGradingResult }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const pct = result.overall.max > 0 ? result.overall.marks / result.overall.max : 0;
  const { bg, fg } = scoreColor(pct);

  return (
    <div className="fade-in-up">
      <div style={{ ...cardStyle, background: bg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: fg }}>
            {result.manualGrade ? "Final score" : "AI evaluation"}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: fg }}>
            {result.manualGrade ? result.manualGrade.marksAwarded : result.overall.marks} / {result.overall.max}
          </div>
        </div>
        <p style={{ color: "var(--ink)", fontSize: 14, marginTop: 8 }}>{result.overall.verdict}</p>
        {result.manualGrade && (
          <p style={{ color: "var(--ink2)", fontSize: 12.5, marginTop: 10 }}>
            Manually graded by {result.manualGrade.gradedByName}
            {result.manualGrade.comment ? ` — "${result.manualGrade.comment}"` : ""}
          </p>
        )}
      </div>

      <div style={cardStyle}>
        <button
          onClick={() => setShowTranscript((s) => !s)}
          style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}
        >
          {showTranscript ? "Hide" : "Show"} transcript
        </button>
        {showTranscript && (
          <div style={{ marginTop: 12, fontSize: 13.5, color: "var(--ink2)", maxHeight: 240, overflowY: "auto", lineHeight: 1.7 }}>
            {result.transcript.map((l) => (
              <div key={l.lineId}>{l.text}</div>
            ))}
          </div>
        )}
      </div>

      {result.parts.map((part) => (
        <div key={part.partId} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{part.name}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {part.marksAwarded} / {part.marksMax}
            </div>
          </div>
          {!part.detected && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>This part wasn&apos;t found in your answer.</p>}

          {part.presentPoints.map((p) => (
            <div key={p.pointId} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13.5 }}>
              <span style={{ color: "var(--green)" }}>✓</span>
              <div>
                <div style={{ color: "var(--ink)" }}>
                  {p.text} {p.credit === "partial" && <span style={{ color: "var(--amber)", fontWeight: 700 }}>(partial credit)</span>}
                </div>
                {p.learnerPhrasing && <div style={{ color: "var(--ink2)", fontSize: 12.5, marginTop: 2 }}>&quot;{p.learnerPhrasing}&quot;</div>}
              </div>
            </div>
          ))}
          {part.missingPoints.map((p) => (
            <div key={p.pointId} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13.5 }}>
              <span style={{ color: "var(--red)" }}>✗</span>
              <div>
                <div style={{ color: "var(--ink)" }}>
                  {p.text} <span style={{ color: "var(--red)", fontWeight: 700 }}>(−{p.marksLost})</span>
                </div>
                {p.suggestedAddition && <div style={{ color: "var(--ink2)", fontSize: 12.5, marginTop: 2 }}>💡 {p.suggestedAddition}</div>}
              </div>
            </div>
          ))}
          {part.partComment && <p style={{ color: "var(--ink2)", fontSize: 12.5, marginTop: 8 }}>{part.partComment}</p>}
        </div>
      ))}

      {result.forbiddenFound.length > 0 && (
        <div style={{ ...cardStyle, background: "var(--red-soft)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--red)", marginBottom: 8 }}>Issues found</div>
          {result.forbiddenFound.map((f, i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--ink)", marginBottom: 6 }}>
              {f.text} — {f.whyItCosts}
            </div>
          ))}
        </div>
      )}

      {result.bonusPoints.length > 0 && (
        <div style={{ ...cardStyle, background: "var(--orange-soft)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--orange)", marginBottom: 8 }}>Bonus points</div>
          {result.bonusPoints.map((b, i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--ink)", marginBottom: 6 }}>
              {b.text}
            </div>
          ))}
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Model answer</div>
        <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: result.modelAnswerRef }} />
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Your upgraded answer</div>
        <p style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{result.upgradedAnswer}</p>
      </div>
    </div>
  );
}
