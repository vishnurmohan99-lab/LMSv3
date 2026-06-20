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
    <div style={{ maxWidth: 640, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 20 }}>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>{note.summary}</p>
      {note.keyPoints.length > 0 && (
        <ul style={{ marginTop: 14, paddingLeft: 20, display: "grid", gap: 6 }}>
          {note.keyPoints.map((point, i) => (
            <li key={i} style={{ fontSize: 14, color: "var(--ink2)" }}>
              {point}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
