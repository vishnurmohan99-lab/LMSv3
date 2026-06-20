"use client";

import { useEffect, useState } from "react";
import { flashcardsApi, ApiError, type Flashcard } from "@/lib/api";

export default function FlashcardReview({ lessonId }: { lessonId: string }) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [knownCount, setKnownCount] = useState(0);

  function load() {
    setLoading(true);
    setDone(false);
    setIndex(0);
    setFlipped(false);
    setKnownCount(0);
    flashcardsApi
      .list(lessonId)
      .then(setCards)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load flashcards"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [lessonId]);

  async function onMark(status: "LEARNING" | "KNOWN") {
    const card = cards[index];
    if (!card) return;
    try {
      await flashcardsApi.setProgress(card.id, status);
    } catch {
      // non-fatal - progress tracking shouldn't block review
    }
    if (status === "KNOWN") setKnownCount((c) => c + 1);
    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(index + 1);
      setFlipped(false);
    }
  }

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading flashcards…</p>;
  if (error) return <p style={{ color: "var(--red)" }}>{error}</p>;
  if (cards.length === 0) {
    return (
      <div style={{ padding: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, color: "var(--ink2)" }}>
        No flashcards have been added to this lesson yet.
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ padding: 24, background: "var(--green-soft)", borderRadius: 14, color: "var(--green)" }}>
        <b>Deck complete!</b>
        <p style={{ marginTop: 6, fontSize: 14 }}>
          You knew {knownCount} of {cards.length} cards.
        </p>
        <button
          onClick={load}
          style={{
            marginTop: 14,
            padding: "9px 18px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Review again
        </button>
      </div>
    );
  }

  const card = cards[index];

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 10 }}>
        Card {index + 1} of {cards.length}
      </div>

      <div
        onClick={() => setFlipped((f) => !f)}
        style={{
          minHeight: 200,
          padding: 28,
          background: flipped ? "var(--orange-soft)" : "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rl)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontSize: 18,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {flipped ? card.back : card.front}
      </div>
      <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink3)", marginTop: 8 }}>
        Tap the card to {flipped ? "see the question" : "reveal the answer"}
      </p>

      {flipped && (
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button
            onClick={() => onMark("LEARNING")}
            style={{
              flex: 1,
              padding: "11px 16px",
              background: "var(--amber-soft)",
              color: "var(--amber)",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Still learning
          </button>
          <button
            onClick={() => onMark("KNOWN")}
            style={{
              flex: 1,
              padding: "11px 16px",
              background: "var(--green-soft)",
              color: "var(--green)",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
