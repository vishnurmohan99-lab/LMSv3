"use client";

import { useEffect, useState } from "react";
import { answerQuestionsApi, answerSubmissionsApi, uploadsApi, ApiError, type AnswerQuestion, type AnswerGradingResult } from "@/lib/api";
import EvaluationResult from "./EvaluationResult";

export default function QuestionDetail({ questionId }: { questionId: string }) {
  const [question, setQuestion] = useState<AnswerQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnswerGradingResult | null>(null);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  useEffect(() => {
    answerQuestionsApi
      .get(questionId)
      .then(setQuestion)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load question"))
      .finally(() => setLoading(false));
  }, [questionId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setFailMessage(null);
    try {
      const fileKey = await uploadsApi.uploadAnswerSubmission(file);
      const res = await answerSubmissionsApi.submit({ questionId, fileKey, fileType: file.type });
      if (res.status === "GRADED" && res.result) {
        setResult(res.result);
      } else {
        setFailMessage(res.errorMessage ?? "Grading failed. Please try again.");
      }
    } catch (err) {
      setFailMessage(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--red)" }}>{error}</p>;
  if (!question) return null;

  if (result) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <EvaluationResult result={result} />
        <button
          onClick={() => {
            setResult(null);
            setFile(null);
          }}
          style={{
            marginTop: 8,
            padding: "11px 22px",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          ← Back to question
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24, marginBottom: 20 }}>
        {question.directive && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              color: "var(--purple)",
              background: "var(--purple-soft)",
              padding: "3px 9px",
              borderRadius: 7,
              textTransform: "uppercase",
            }}
          >
            {question.directive}
          </span>
        )}
        <div style={{ fontSize: 17, fontWeight: 600, margin: "12px 0", lineHeight: 1.5 }}>{question.text}</div>
        <div style={{ fontSize: 13, color: "var(--ink2)", fontWeight: 600 }}>{question.maxMarks} marks</div>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Upload your answer</div>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={submitting}
            style={{ fontSize: 13.5 }}
          />
          {failMessage && <p style={{ color: "var(--red)", fontSize: 13 }}>{failMessage}</p>}
          {submitting && <p style={{ color: "var(--ink2)", fontSize: 13.5 }}>Grading your answer — this can take 10–30 seconds…</p>}
          <button
            type="submit"
            disabled={!file || submitting}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "13px 26px",
              background: "var(--orange)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: !file || submitting ? "default" : "pointer",
              opacity: !file || submitting ? 0.6 : 1,
              width: "fit-content",
            }}
          >
            {submitting ? "Grading…" : "Submit for grading"}
          </button>
        </form>
      </div>
    </div>
  );
}
