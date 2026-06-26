"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { answerQuestionsApi, ApiError, type AnswerQuestion } from "@/lib/api";

export default function QuestionBrowseList({ basePath }: { basePath: "student" | "faculty" }) {
  const [questions, setQuestions] = useState<AnswerQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    answerQuestionsApi
      .list({ published: true })
      .then(setQuestions)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load questions"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading questions…</p>;
  if (error) return <p style={{ color: "var(--red)" }}>{error}</p>;
  if (questions.length === 0) {
    return (
      <div style={{ padding: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, color: "var(--ink2)" }}>
        No questions are available yet.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {questions.map((q) => (
        <Link
          key={q.id}
          href={`/${basePath}/answer-correction/${q.id}`}
          className="entity-card"
          style={{
            display: "block",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--rl)",
            padding: 18,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          {q.directive && (
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
              {q.directive}
            </span>
          )}
          <div
            style={{
              fontWeight: 600,
              fontSize: 14.5,
              margin: "10px 0 14px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            {q.text}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: "var(--ink2)", fontWeight: 600 }}>{q.maxMarks} marks</span>
            <span style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>Attempt →</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
