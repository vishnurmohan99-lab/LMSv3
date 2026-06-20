"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { notesApi, ApiError, type LessonNote } from "@/lib/api";
import Spinner from "@/components/Spinner";

export default function ManageNotesPage() {
  const params = useParams<{ id: string; lessonId: string }>();
  const { id: courseId, lessonId } = params;

  const [note, setNote] = useState<LessonNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  function load() {
    setLoading(true);
    notesApi
      .get(lessonId)
      .then(setNote)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load notes"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [lessonId]);

  async function onGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const result = await notesApi.generate(lessonId);
      setNote(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate notes");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 700 }}>
      <Link href={`/admin/courses/${courseId}`} style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
        ← Back to course
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>AI Notes</h1>
        <button
          onClick={onGenerate}
          disabled={generating}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 16px",
            background: "var(--orange)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: generating ? "default" : "pointer",
            opacity: generating ? 0.7 : 1,
          }}
        >
          {generating && <Spinner />}
          {generating ? "Generating…" : note ? "Regenerate with AI" : "Generate with AI"}
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : !note ? (
        <p style={{ color: "var(--ink2)" }}>No notes have been generated for this lesson yet.</p>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 20 }}>
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
      )}
    </div>
  );
}
