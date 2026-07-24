"use client";

import { useCallback, useEffect, useState } from "react";
import { flashcardsApi, ApiError, type FlashcardStatus } from "@/lib/api";

/** The minimum shape both a lesson Flashcard and a hub ReviewCard satisfy. */
type SessionCard = {
  id: string;
  front: string;
  back: string;
  topic?: string;
  status?: FlashcardStatus;
  intervalDays?: number;
  dueAt?: string | null;
  preview?: { again: string; hard: string; good: string };
};

export type SessionTally = { reviewed: number; got: number; hard: number; again: number };

/**
 * Flip-card review with SM-2 grading. Two modes:
 *  - Lesson mode  ({ lessonId }): loads that lesson's deck, linear, ends on an internal
 *    "Deck complete" screen with "Practice again". Unchanged from before.
 *  - Hub mode     ({ cards, onExhausted }): reviews a supplied cross-lesson queue. "Again"
 *    re-queues the card to the back so lapsed cards resurface before the session ends;
 *    when every card has been cleared it calls onExhausted so the hub shows its own summary.
 */
export default function FlashcardReview({
  lessonId,
  lessonTitle,
  cards: supplied,
  onExhausted,
}: {
  lessonId?: string;
  lessonTitle?: string;
  cards?: SessionCard[];
  onExhausted?: (tally: SessionTally) => void;
}) {
  const isHub = supplied !== undefined;

  const [deck, setDeck] = useState<SessionCard[]>(supplied ?? []);
  const [queue, setQueue] = useState<number[]>(supplied ? supplied.map((_, i) => i) : []);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(!isHub);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false); // lesson-mode completion screen
  const [got, setGot] = useState(0);
  const [hard, setHard] = useState(0);
  const [again, setAgain] = useState(0);

  const reset = useCallback((cards: SessionCard[]) => {
    setDeck(cards);
    setQueue(cards.map((_, i) => i));
    setFlipped(false);
    setDone(false);
    setGot(0);
    setHard(0);
    setAgain(0);
  }, []);

  // Lesson mode: load the deck. Hub mode: (re)seed from the supplied cards.
  useEffect(() => {
    if (isHub) {
      reset(supplied ?? []);
      return;
    }
    if (!lessonId) return;
    setLoading(true);
    flashcardsApi
      .list(lessonId)
      .then((cs) => reset(cs))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load flashcards"))
      .finally(() => setLoading(false));
    // supplied is a stable reference per session from the parent; reset handles re-seeding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, supplied, isHub, reset]);

  const total = deck.length;
  const idx = queue[0];
  const card = idx !== undefined ? deck[idx] : undefined;
  const distinctRemaining = new Set(queue).size;
  const cleared = total - distinctRemaining;

  function grade(g: "AGAIN" | "HARD" | "GOOD") {
    if (card) {
      // Server schedules the next review; fold the returned state back so composition
      // chips and interval labels stay truthful without a refetch.
      flashcardsApi
        .grade(card.id, g)
        .then((p) =>
          setDeck((prev) => prev.map((c) => (c.id === card.id ? { ...c, status: p.status, intervalDays: p.intervalDays, dueAt: p.dueAt } : c))),
        )
        .catch(() => {});
    }
    if (g === "GOOD") setGot((n) => n + 1);
    else if (g === "HARD") setHard((n) => n + 1);
    else setAgain((n) => n + 1);

    // Compute the next queue from the current value (one grade per render), keeping the
    // completion side-effect out of the state updater so StrictMode can't double-fire it.
    const [head, ...rest] = queue;
    // Hub: a lapsed ("Again") card goes to the back so it comes round again this session.
    const next = isHub && g === "AGAIN" ? [...rest, head] : rest;
    setQueue(next);
    setFlipped(false);
    if (next.length === 0) {
      if (isHub) {
        onExhausted?.({
          reviewed: total,
          got: got + (g === "GOOD" ? 1 : 0),
          hard: hard + (g === "HARD" ? 1 : 0),
          again: again + (g === "AGAIN" ? 1 : 0),
        });
      } else {
        setDone(true);
      }
    }
  }

  const statusCounts = deck.reduce(
    (acc, c) => {
      acc[c.status ?? "NEW"] += 1;
      return acc;
    },
    { NEW: 0, LEARNING: 0, KNOWN: 0 } as Record<"NEW" | "LEARNING" | "KNOWN", number>,
  );

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading flashcards…</p>;
  if (error) return <p style={{ color: "var(--red)" }}>{error}</p>;
  if (deck.length === 0) {
    return (
      <div style={{ padding: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, color: "var(--ink2)" }}>
        No flashcards have been added to this lesson yet.
      </div>
    );
  }

  // Hub mode has finished — the parent renders its own summary from onExhausted.
  if (isHub && queue.length === 0) return null;

  // Lesson-mode completion screen (unchanged).
  if (done) {
    return (
      <div
        className="pop-in"
        style={{ textAlign: "center", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: "48px 40px", maxWidth: 620, margin: "0 auto" }}
      >
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--orange-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", fontSize: 34 }}>
          🎉
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4 }}>Deck complete!</div>
        <p style={{ color: "var(--ink3)", fontSize: 14, margin: "8px 0 26px" }}>You reviewed all {total} flashcards. Here&apos;s how you did.</p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 28, flexWrap: "wrap" }}>
          <div style={{ background: "var(--green-soft)", borderRadius: 14, padding: "18px 26px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--green)" }}>{got}</div>
            <div style={{ fontSize: 12, color: "var(--ink2)", fontWeight: 600 }}>Got it</div>
          </div>
          <div style={{ background: "var(--amber-soft)", borderRadius: 14, padding: "18px 26px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--amber-ink)" }}>{hard}</div>
            <div style={{ fontSize: 12, color: "var(--ink2)", fontWeight: 600 }}>Hard</div>
          </div>
          <div style={{ background: "var(--red-soft)", borderRadius: 14, padding: "18px 26px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--red)" }}>{again}</div>
            <div style={{ fontSize: 12, color: "var(--ink2)", fontWeight: 600 }}>Again</div>
          </div>
        </div>
        <button
          onClick={() => lessonId && flashcardsApi.list(lessonId).then((cs) => reset(cs)).catch(() => {})}
          style={{ padding: "13px 26px", background: "var(--orange)", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
        >
          Practice again
        </button>
      </div>
    );
  }

  if (!card) return null;
  const pct = total ? Math.round((cleared / total) * 100) : 0;

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      {!isHub && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "var(--orange)", background: "var(--orange-soft)", padding: "5px 11px", borderRadius: 8, textTransform: "uppercase" }}>
            ⚡ Flashcards
          </span>
          {lessonTitle && (
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lessonTitle}</span>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: isHub ? 8 : 18 }}>
        {isHub ? (
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink2)" }}>
            Card {cleared + 1} of {total}
            {card.topic ? ` · ${card.topic}` : ""}
          </span>
        ) : null}
        <div style={{ flex: 1, height: isHub ? 6 : 8, background: isHub ? "var(--line2)" : "var(--card)", border: isHub ? "none" : "1px solid var(--line)", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--orange)", borderRadius: 5, transition: "width .3s" }} />
        </div>
        {!isHub && (
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", background: "var(--green-soft)", padding: "5px 11px", borderRadius: 8 }}>✓ {got}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--amber-ink)", background: "var(--amber-soft)", padding: "5px 11px", borderRadius: 8 }}>~ {hard}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--red)", background: "var(--red-soft)", padding: "5px 11px", borderRadius: 8 }}>✕ {again}</span>
          </div>
        )}
        {isHub && <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--ink3)" }}>{pct}%</span>}
      </div>

      {!isHub && (
        <div style={{ fontSize: 12, color: "var(--ink3)", textAlign: "center", marginBottom: 12 }}>
          Card {cleared + 1} of {total} — tap to reveal
        </div>
      )}

      <div className="flip-card-scene" onClick={() => setFlipped((f) => !f)} style={{ width: "100%", height: 320 }}>
        <div className="flip-card-inner" style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
          <div className="flip-card-face" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", boxShadow: "0 16px 40px rgba(242,106,27,.10)", padding: 40, overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -60, right: -60, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, var(--orange-soft), transparent 70%)" }} />
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "var(--orange)", background: "var(--orange-soft)", display: "inline-block", padding: "5px 12px", borderRadius: 8, textTransform: "uppercase", marginBottom: 18 }}>
              {isHub && card.topic ? card.topic : "Question"}
            </div>
            <div className="flip-card-question-text" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.4, letterSpacing: -0.3, position: "relative" }}>{card.front}</div>
            <div style={{ position: "absolute", bottom: 22, fontSize: 12, color: "var(--ink3)" }}>Tap to flip ↺</div>
          </div>
          <div className="flip-card-face flip-card-back" style={{ background: "linear-gradient(135deg, var(--ink) 0%, #2b1608 100%)", color: "#fff", borderRadius: "var(--rl)", boxShadow: "0 16px 40px rgba(242,106,27,.22)", padding: 40, overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -60, left: -60, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(242,106,27,.28), transparent 70%)" }} />
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "var(--orange)", background: "rgba(242,106,27,.16)", display: "inline-block", padding: "5px 12px", borderRadius: 8, textTransform: "uppercase", marginBottom: 18 }}>
              Answer
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.6, position: "relative" }}>{card.back}</div>
          </div>
        </div>
      </div>

      {flipped && (
        <>
          {/* SM-2 grading. Sub-labels are the server's projected next interval for this exact card. */}
          <div className="fade-in-up" style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "center", flexWrap: "wrap" }}>
            {([
              { grade: "AGAIN" as const, label: "Again", sub: card.preview?.again, bg: "var(--red-soft)", ink: "var(--red-ink)" },
              { grade: "HARD" as const, label: "Hard", sub: card.preview?.hard, bg: "var(--amber-soft)", ink: "var(--amber-ink)" },
              { grade: "GOOD" as const, label: "Got it", sub: card.preview?.good, bg: "var(--green-soft)", ink: "var(--green)" },
            ]).map((b) => (
              <button
                key={b.grade}
                onClick={() => grade(b.grade)}
                style={{ background: b.bg, color: b.ink, border: "none", borderRadius: 14, padding: "7px 18px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 92 }}
              >
                {b.label}
                {b.sub && <span style={{ fontSize: 9, fontWeight: 500, fontFamily: "var(--font-mono)", opacity: 0.75 }}>{b.sub}</span>}
              </button>
            ))}
          </div>

          {/* Session composition — NEW / LEARNING / KNOWN. */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9.5, fontWeight: 600, fontFamily: "var(--font-mono)", background: "var(--purple-soft)", color: "var(--purple-ink)", borderRadius: 999, padding: "3px 9px" }}>{statusCounts.NEW} NEW</span>
            <span style={{ fontSize: 9.5, fontWeight: 600, fontFamily: "var(--font-mono)", background: "var(--amber-soft)", color: "var(--amber-ink)", borderRadius: 999, padding: "3px 9px" }}>{statusCounts.LEARNING} LEARNING</span>
            <span style={{ fontSize: 9.5, fontWeight: 600, fontFamily: "var(--font-mono)", background: "var(--green-soft)", color: "var(--green)", borderRadius: 999, padding: "3px 9px" }}>{statusCounts.KNOWN} KNOWN</span>
          </div>
        </>
      )}
    </div>
  );
}
