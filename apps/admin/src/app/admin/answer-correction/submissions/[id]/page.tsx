"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { answerSubmissionsApi, ApiError, type AnswerGradingResult } from "@/lib/api";
import Spinner from "@/components/Spinner";

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--rl)",
  padding: 20,
  marginBottom: 16,
};

export default function AdminAnswerSubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const [result, setResult] = useState<AnswerGradingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [marksAwarded, setMarksAwarded] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    answerSubmissionsApi
      .get(params.id)
      .then((r) => {
        setResult(r);
        setMarksAwarded(r.manualGrade?.marksAwarded ?? r.overall.marks);
        setComment(r.manualGrade?.comment ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load submission"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [params.id]);

  async function onGrade(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await answerSubmissionsApi.grade(params.id, { marksAwarded: Number(marksAwarded), comment: comment || undefined });
      setResult(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save grade");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ padding: 40, color: "var(--ink2)" }}>Loading…</p>;
  if (error && !result) return <p style={{ padding: 40, color: "var(--red)" }}>{error}</p>;
  if (!result) return null;

  return (
    <div className="fade-in" style={{ padding: "30px 40px 80px", maxWidth: 800 }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 18 }}>Submission review</div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>AI evaluation</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            {result.overall.marks} / {result.overall.max}
          </div>
        </div>
        <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 14 }}>{result.overall.verdict}</p>

        {result.parts.map((part) => (
          <div key={part.partId} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>
              <span>{part.name}</span>
              <span>
                {part.marksAwarded} / {part.marksMax}
              </span>
            </div>
            {part.presentPoints.map((p) => (
              <div key={p.pointId} style={{ fontSize: 12.5, color: "var(--green)", marginBottom: 3 }}>
                ✓ {p.text} {p.credit === "partial" ? "(partial)" : ""}
              </div>
            ))}
            {part.missingPoints.map((p) => (
              <div key={p.pointId} style={{ fontSize: 12.5, color: "var(--red)", marginBottom: 3 }}>
                ✗ {p.text} (−{p.marksLost})
              </div>
            ))}
          </div>
        ))}

        {result.forbiddenFound.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--red)", marginBottom: 6 }}>Forbidden content found</div>
            {result.forbiddenFound.map((f, i) => (
              <div key={i} style={{ fontSize: 12.5, color: "var(--red)" }}>
                {f.text} ({f.penaltyType === "FLAG_HARD" ? "flagged" : `−${f.penalty}`})
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Transcript</div>
        <div style={{ fontSize: 13, color: "var(--ink2)", maxHeight: 200, overflowY: "auto" }}>
          {result.transcript.map((l) => (
            <div key={l.lineId}>{l.text}</div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Manual grade</div>
        {result.manualGrade && (
          <p style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 12 }}>
            Currently graded by {result.manualGrade.gradedByName} on {new Date(result.manualGrade.gradedAt).toLocaleDateString()}:{" "}
            <b>
              {result.manualGrade.marksAwarded}/{result.overall.max}
            </b>
          </p>
        )}
        <form onSubmit={onGrade} style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Marks awarded (out of {result.overall.max})</div>
            <input
              type="number"
              min={0}
              max={result.overall.max}
              step="0.5"
              value={marksAwarded}
              onChange={(e) => setMarksAwarded(Number(e.target.value))}
              style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 14, width: 160 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Comment (optional)</div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 14, width: "100%", fontFamily: "inherit" }}
            />
          </div>
          {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
          <button
            type="submit"
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 22px",
              background: "var(--ink)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.6 : 1,
              width: "fit-content",
            }}
          >
            {saving && <Spinner />}
            {saving ? "Saving…" : "Save grade"}
          </button>
        </form>
      </div>
    </div>
  );
}
