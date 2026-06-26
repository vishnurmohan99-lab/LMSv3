"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { answerSubmissionsApi, ApiError, type AnswerGradingResult } from "@/lib/api";
import EvaluationResult from "@/components/answer-correction/EvaluationResult";

export default function FacultySubmissionDetailPage() {
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
    <div className="fade-in-up" style={{ padding: "30px 36px 80px", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, marginBottom: 18 }}>Submission review</div>

      <EvaluationResult result={result} />

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Manual grade</div>
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
              background: "var(--orange)",
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
            {saving ? "Saving…" : "Save grade"}
          </button>
        </form>
      </div>
    </div>
  );
}
