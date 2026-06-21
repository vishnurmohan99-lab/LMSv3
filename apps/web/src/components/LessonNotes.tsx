"use client";

import { useEffect, useState } from "react";
import { notesApi, ApiError, type LessonNote } from "@/lib/api";

export default function LessonNotes({ lessonId }: { lessonId: string }) {
  const [note, setNote] = useState<LessonNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    notesApi
      .get(lessonId)
      .then(setNote)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load notes"))
      .finally(() => setLoading(false));
  }, [lessonId]);

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading notes…</p>;
  if (error) return <p style={{ color: "var(--red)" }}>{error}</p>;
  if (!note) {
    return (
      <div style={{ padding: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, color: "var(--ink2)" }}>
        No AI notes have been generated for this lesson yet.
      </div>
    );
  }

  return (
    <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            background: "var(--orange-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2">
            <path d="M12 2 9 9l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1z" />
          </svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700 }}>AI Notes</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--orange)",
            background: "var(--orange-soft)",
            padding: "2px 8px",
            borderRadius: 6,
            letterSpacing: 0.3,
          }}
        >
          AUTO-GENERATED
        </span>
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--ink2)", margin: 0 }}>{note.summary}</p>
      {note.keyPoints.length > 0 && (
        <ul style={{ marginTop: 14, paddingLeft: 20, display: "grid", gap: 6 }}>
          {note.keyPoints.map((point, i) => (
            <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink2)" }}>
              {point}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
