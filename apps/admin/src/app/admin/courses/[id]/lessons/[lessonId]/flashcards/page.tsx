"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { flashcardsApi, ApiError, type Flashcard } from "@/lib/api";
import Spinner from "@/components/Spinner";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
  width: "100%",
};

export default function ManageFlashcardsPage() {
  const params = useParams<{ id: string; lessonId: string }>();
  const { id: courseId, lessonId } = params;

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);

  function load() {
    setLoading(true);
    flashcardsApi
      .list(lessonId)
      .then(setFlashcards)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load flashcards"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [lessonId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await flashcardsApi.create(lessonId, { front, back, order: flashcards.length });
      setFront("");
      setBack("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add flashcard");
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id: string) {
    await flashcardsApi.remove(id);
    load();
  }

  async function onGenerate() {
    setError(null);
    setGenerating(true);
    try {
      await flashcardsApi.generate(lessonId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate flashcards");
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
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Manage flashcards</h1>
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
          {generating ? "Generating…" : "Generate with AI"}
        </button>
      </div>

      <form
        onSubmit={onCreate}
        style={{
          display: "grid",
          gap: 10,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: 18,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          <input required placeholder="Front (question)" value={front} onChange={(e) => setFront(e.target.value)} style={inputStyle} />
          <input required placeholder="Back (answer)" value={back} onChange={(e) => setBack(e.target.value)} style={inputStyle} />
        </div>
        <button
          type="submit"
          disabled={creating}
          style={{
            padding: "10px 18px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: creating ? "default" : "pointer",
            opacity: creating ? 0.7 : 1,
            justifySelf: "start",
          }}
        >
          {creating ? "Adding…" : "Add flashcard"}
        </button>
      </form>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : flashcards.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No flashcards yet — add the first one above.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {flashcards.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 14,
                padding: 14,
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 12,
              }}
            >
              <div style={{ flex: 1, fontSize: 14 }}>
                <div style={{ fontWeight: 700 }}>{f.front}</div>
                <div style={{ color: "var(--ink2)", marginTop: 4 }}>{f.back}</div>
              </div>
              <button
                onClick={() => onDelete(f.id)}
                style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 12, flex: "none" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
