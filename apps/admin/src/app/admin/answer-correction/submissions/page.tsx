"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { answerSubmissionsApi, ApiError, type AnswerSubmissionSummary } from "@/lib/api";

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  fontSize: 11.5,
  fontWeight: 700,
  padding: "3px 9px",
  borderRadius: 7,
  background: bg,
  color,
});

export default function AnswerSubmissionsQueuePage() {
  const [submissions, setSubmissions] = useState<AnswerSubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    answerSubmissionsApi
      .list()
      .then(setSubmissions)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load submissions"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 4 }}>Grading queue</div>
      <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 24 }}>All student submissions for Answer Correction questions.</p>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}
      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : submissions.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No submissions yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {submissions.map((s) => (
            <Link
              key={s.id}
              href={`/admin/answer-correction/submissions/${s.id}`}
              className="entity-card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rl)",
                padding: "14px 18px",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{s.studentName}</div>
                <div style={{ fontSize: 13, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 460 }}>
                  {s.questionText}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "none" }}>
                {s.marksAwarded !== undefined && (
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    {s.marksAwarded}/{s.marksMax}
                  </span>
                )}
                {s.status === "FAILED" ? (
                  <span style={badgeStyle("var(--red-soft)", "var(--red)")}>Failed</span>
                ) : s.manualGradedAt ? (
                  <span style={badgeStyle("var(--green-soft)", "var(--green)")}>Graded</span>
                ) : (
                  <span style={badgeStyle("var(--amber-soft)", "var(--amber)")}>Needs review</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
