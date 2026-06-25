"use client";

import { useEffect, useState } from "react";
import { flashcardsApi, ApiError, type Flashcard } from "@/lib/api";

export default function FlashcardReview({ lessonId, lessonTitle }: { lessonId: string; lessonTitle?: string }) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [gotIt, setGotIt] = useState(0);
  const [didntKnow, setDidntKnow] = useState(0);
  const [skipped, setSkipped] = useState(0);

  function load() {
    setLoading(true);
    setDone(false);
    setIndex(0);
    setFlipped(false);
    setGotIt(0);
    setDidntKnow(0);
    setSkipped(0);
    flashcardsApi
      .list(lessonId)
      .then(setCards)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load flashcards"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [lessonId]);

  function advance() {
    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(index + 1);
      setFlipped(false);
    }
  }

  async function onWrong() {
    const card = cards[index];
    if (card) flashcardsApi.setProgress(card.id, "LEARNING").catch(() => {});
    setDidntKnow((c) => c + 1);
    advance();
  }

  function onSkip() {
    setSkipped((c) => c + 1);
    advance();
  }

  async function onRight() {
    const card = cards[index];
    if (card) flashcardsApi.setProgress(card.id, "KNOWN").catch(() => {});
    setGotIt((c) => c + 1);
    advance();
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
      <div
        className="pop-in"
        style={{
          textAlign: "center",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rl)",
          padding: "48px 40px",
          maxWidth: 620,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--orange-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
            fontSize: 34,
          }}
        >
          🎉
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4 }}>Deck complete!</div>
        <p style={{ color: "var(--ink3)", fontSize: 14, margin: "8px 0 26px" }}>
          You reviewed all {cards.length} flashcards. Here&apos;s how you did.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 28, flexWrap: "wrap" }}>
          <div style={{ background: "var(--orange-soft)", borderRadius: 14, padding: "18px 26px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--orange)" }}>{gotIt}</div>
            <div style={{ fontSize: 12, color: "var(--ink2)", fontWeight: 600 }}>Got it</div>
          </div>
          <div style={{ background: "var(--red-soft)", borderRadius: 14, padding: "18px 26px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--red)" }}>{didntKnow}</div>
            <div style={{ fontSize: 12, color: "var(--ink2)", fontWeight: 600 }}>Didn&apos;t know</div>
          </div>
          <div style={{ background: "var(--bg)", borderRadius: 14, padding: "18px 26px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink2)" }}>{skipped}</div>
            <div style={{ fontSize: 12, color: "var(--ink2)", fontWeight: 600 }}>Skipped</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={load}
            style={{
              padding: "13px 26px",
              background: "var(--orange)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Practice again
          </button>
        </div>
      </div>
    );
  }

  const card = cards[index];
  const progressPct = Math.round((index / cards.length) * 100);

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1,
            color: "var(--orange)",
            background: "var(--orange-soft)",
            padding: "5px 11px",
            borderRadius: 8,
            textTransform: "uppercase",
          }}
        >
          ⚡ Flashcards
        </span>
        {lessonTitle && (
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lessonTitle}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div style={{ flex: 1, height: 8, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ width: `${progressPct}%`, height: "100%", background: "var(--orange)", borderRadius: 5, transition: "width .3s" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--orange)", background: "var(--orange-soft)", padding: "5px 11px", borderRadius: 8 }}>
            ✓ {gotIt}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--red)", background: "var(--red-soft)", padding: "5px 11px", borderRadius: 8 }}>
            ✕ {didntKnow}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)", background: "var(--bg)", padding: "5px 11px", borderRadius: 8 }}>
            ↷ {skipped}
          </span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--ink3)", textAlign: "center", marginBottom: 12 }}>
        Card {index + 1} of {cards.length} — tap to reveal
      </div>

      <div
        className="flip-card-scene"
        onClick={() => setFlipped((f) => !f)}
        style={{ width: "100%", maxWidth: 420, aspectRatio: "1 / 1", margin: "0 auto" }}
      >
        <div className="flip-card-inner" style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
          <div
            className="flip-card-face"
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--rl)",
              boxShadow: "0 16px 40px rgba(242,106,27,.10)",
              padding: 40,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -60,
                right: -60,
                width: 160,
                height: 160,
                borderRadius: "50%",
                background: "radial-gradient(circle, var(--orange-soft), transparent 70%)",
              }}
            />
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1,
                color: "var(--orange)",
                background: "var(--orange-soft)",
                display: "inline-block",
                padding: "5px 12px",
                borderRadius: 8,
                textTransform: "uppercase",
                marginBottom: 18,
              }}
            >
              Question
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.4, letterSpacing: -0.3, position: "relative" }}>{card.front}</div>
            <div style={{ position: "absolute", bottom: 22, fontSize: 12, color: "var(--ink3)" }}>Tap to flip ↺</div>
          </div>
          <div
            className="flip-card-face flip-card-back"
            style={{
              background: "linear-gradient(135deg, var(--ink) 0%, #2b1608 100%)",
              color: "#fff",
              borderRadius: "var(--rl)",
              boxShadow: "0 16px 40px rgba(242,106,27,.22)",
              padding: 40,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -60,
                left: -60,
                width: 160,
                height: 160,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(242,106,27,.28), transparent 70%)",
              }}
            />
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1,
                color: "var(--orange)",
                background: "rgba(242,106,27,.16)",
                display: "inline-block",
                padding: "5px 12px",
                borderRadius: 8,
                textTransform: "uppercase",
                marginBottom: 18,
              }}
            >
              Answer
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.6, position: "relative" }}>{card.back}</div>
          </div>
        </div>
      </div>

      {flipped && (
        <div className="fade-in-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 24 }}>
          <button
            onClick={onWrong}
            style={{
              padding: 14,
              background: "var(--red-soft)",
              border: "1.5px solid var(--red-line)",
              color: "var(--red)",
              borderRadius: 13,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Didn&apos;t know
          </button>
          <button
            onClick={onSkip}
            style={{
              padding: 14,
              background: "var(--card)",
              border: "1.5px solid var(--line)",
              color: "var(--ink2)",
              borderRadius: 13,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Skip
          </button>
          <button
            onClick={onRight}
            style={{
              padding: 14,
              background: "var(--orange)",
              border: "none",
              color: "#fff",
              borderRadius: 13,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(242,106,27,.32)",
            }}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
