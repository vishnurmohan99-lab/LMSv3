"use client";

import { useRef, useState, useEffect } from "react";
import { summaryDeckApi, ApiError, type SummaryDeck } from "@/lib/api";

export default function SummaryDeckReview({ lessonId }: { lessonId: string }) {
  const [deck, setDeck] = useState<SummaryDeck | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setIndex(0);
    summaryDeckApi
      .get(lessonId)
      .then(setDeck)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load summary deck"))
      .finally(() => setLoading(false));
  }, [lessonId]);

  const cards = deck?.cards ?? [];

  function goNext() {
    setIndex((i) => Math.min(cards.length - 1, i + 1));
  }
  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -50) goNext();
    else if (delta > 50) goPrev();
    touchStartX.current = null;
  }

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading summary deck…</p>;
  if (error) return <p style={{ color: "var(--red)" }}>{error}</p>;
  if (cards.length === 0) {
    return (
      <div style={{ padding: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, color: "var(--ink2)" }}>
        No summary deck has been generated for this lesson yet.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        {cards.map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              background: i <= index ? "var(--purple)" : "var(--bg)",
              border: i <= index ? "none" : "1px solid var(--line)",
              transition: "background .2s",
            }}
          />
        ))}
      </div>

      <div style={{ fontSize: 12, color: "var(--ink3)", textAlign: "center", marginBottom: 12 }}>
        Card {index + 1} of {cards.length} — swipe or use the arrows
      </div>

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          minHeight: 280,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rl)",
          boxShadow: "0 12px 40px rgba(0,0,0,.07)",
          padding: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        className="fade-in-up"
        key={index}
      >
        <p style={{ fontSize: 18, lineHeight: 1.6, fontWeight: 600, textAlign: "center" }}>{cards[index]}</p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
        <button
          onClick={goPrev}
          disabled={index === 0}
          style={{
            padding: "11px 22px",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: index === 0 ? "default" : "pointer",
            opacity: index === 0 ? 0.5 : 1,
            color: "var(--ink)",
          }}
        >
          ‹ Previous
        </button>
        <button
          onClick={goNext}
          disabled={index === cards.length - 1}
          style={{
            padding: "11px 22px",
            background: "var(--purple)",
            border: "none",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: index === cards.length - 1 ? "default" : "pointer",
            opacity: index === cards.length - 1 ? 0.5 : 1,
            color: "#fff",
          }}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
