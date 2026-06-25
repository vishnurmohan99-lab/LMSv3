"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { summaryDeckApi, ApiError, type SummaryDeck } from "@/lib/api";

export default function ManageSummaryDeckPage() {
  const params = useParams<{ id: string; lessonId: string }>();
  const { id: courseId, lessonId } = params;

  const [deck, setDeck] = useState<SummaryDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  function load() {
    setLoading(true);
    summaryDeckApi
      .get(lessonId)
      .then(setDeck)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load summary deck"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [lessonId]);

  async function onGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const result = await summaryDeckApi.generate(lessonId);
      setDeck(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate summary deck");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main style={{ padding: 40, maxWidth: 700 }}>
      <Link href={`/admin/courses/${courseId}`} style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
        ← Back to course
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Summary Deck</h1>
        <button
          onClick={onGenerate}
          disabled={generating}
          style={{
            padding: "9px 16px",
            background: "var(--purple)",
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
          {generating ? "Generating…" : deck ? "Regenerate with AI" : "Generate with AI"}
        </button>
      </div>

      <p style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 16 }}>
        A swipeable deck of cards covering the whole video or PDF summary, end to end — for quick review.
      </p>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : !deck || deck.cards.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No summary deck has been generated for this lesson yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {deck.cards.map((card, i) => (
            <div key={i} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--purple)", marginBottom: 6 }}>Card {i + 1}</div>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>{card}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
