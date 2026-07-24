"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flashcardsApi, ApiError, type ReviewCard, type ReviewSummary } from "@/lib/api";
import FlashcardReview, { type SessionTally } from "@/components/FlashcardReview";

type View = "hub" | "session" | "complete";
type Limit = 10 | 20 | 30 | "all";

const LIMITS: Limit[] = [10, 20, 30, "all"];

/** Ported from Design System/Student - Flashcards.dc.html — the standalone daily
 *  spaced-repetition review hub. Reuses FlashcardReview for the session itself. */
export default function StudentFlashcardsPage() {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | "all">("all");
  const [chapterId, setChapterId] = useState<string | "all">("all");
  const [limit, setLimit] = useState<Limit>("all");

  const [view, setView] = useState<View>("hub");
  const [sessionCards, setSessionCards] = useState<ReviewCard[]>([]);
  const [starting, setStarting] = useState(false);
  const [tally, setTally] = useState<SessionTally | null>(null);

  const scope = useMemo(
    () => ({ courseId: courseId === "all" ? undefined : courseId, chapterId: chapterId === "all" ? undefined : chapterId }),
    [courseId, chapterId],
  );

  const loadSummary = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    flashcardsApi
      .reviewSummary(scope)
      .then((s) => !cancelled && setSummary(s))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Failed to load your review"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [scope]);

  useEffect(loadSummary, [loadSummary]);

  const sessionSize = useMemo(() => {
    const due = summary?.dueTotal ?? 0;
    return limit === "all" ? due : Math.min(limit, due);
  }, [summary, limit]);

  async function startReview() {
    setStarting(true);
    setError(null);
    try {
      const cards = await flashcardsApi.due({ ...scope, limit: limit === "all" ? undefined : limit });
      if (cards.length === 0) return; // nothing due — hub already shows the caught-up state
      setSessionCards(cards);
      setTally(null);
      setView("session");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start review");
    } finally {
      setStarting(false);
    }
  }

  function onExhausted(t: SessionTally) {
    setTally(t);
    setView("complete");
    loadSummary(); // reflect the new schedule back on the hub
  }

  // ---- session ----------------------------------------------------------------
  if (view === "session") {
    return (
      <main className="fade-in" style={{ padding: "24px 20px 60px", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Review session</div>
          <span style={{ fontSize: 12, color: "var(--ink3)" }}>
            {courseId === "all" ? "All courses" : summary?.courses.find((c) => c.id === courseId)?.name}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setView("hub")}
            style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink2)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            ✕ End session
          </button>
        </div>
        <FlashcardReview cards={sessionCards} onExhausted={onExhausted} />
      </main>
    );
  }

  // ---- session complete -------------------------------------------------------
  if (view === "complete" && tally) {
    const nextStreak = (summary?.streakDays ?? 0) || 1;
    return (
      <main className="fade-in" style={{ padding: "40px 20px 60px" }}>
        <div
          className="pop-in"
          style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 36 }}
        >
          <div style={{ width: 60, height: 60, borderRadius: 999, background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 26, fontWeight: 700 }}>
            ✓
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.3 }}>All done</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink2)", marginTop: 6, maxWidth: 400, marginInline: "auto" }}>
            You reviewed <b style={{ color: "var(--ink)" }}>{tally.reviewed} card{tally.reviewed === 1 ? "" : "s"}</b>. Come back when the next batch is due.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
            {[
              { n: tally.got, label: "Got it", bg: "var(--green-soft)", ink: "var(--green)" },
              { n: tally.hard, label: "Hard", bg: "var(--amber-soft)", ink: "var(--amber-ink)" },
              { n: tally.again, label: "Again", bg: "var(--red-soft)", ink: "var(--red-ink)" },
            ].map((s) => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "12px 22px" }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-mono)", color: s.ink }}>{s.n}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: s.ink }}>{s.label}</div>
              </div>
            ))}
          </div>
          {nextStreak > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 20, background: "var(--orange-soft)", color: "var(--orange-deep)", borderRadius: 999, padding: "7px 16px", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
              🔥 {nextStreak}-day streak
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22 }}>
            <button onClick={() => setView("hub")} style={{ fontSize: 13, fontWeight: 600, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 11, height: 44, padding: "0 20px", cursor: "pointer", fontFamily: "inherit" }}>
              Back to hub
            </button>
            <button onClick={() => { setView("hub"); startReview(); }} disabled={(summary?.dueTotal ?? 0) === 0} style={{ fontSize: 13, fontWeight: 600, background: "var(--orange)", color: "#fff", border: "none", borderRadius: 11, height: 44, padding: "0 22px", cursor: (summary?.dueTotal ?? 0) === 0 ? "not-allowed" : "pointer", opacity: (summary?.dueTotal ?? 0) === 0 ? 0.5 : 1, fontFamily: "inherit" }}>
              Review more
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---- hub --------------------------------------------------------------------
  const col = summary?.collection;
  const collectionTotal = col?.total ?? 0;
  const due = summary?.dueTotal ?? 0;
  const streak = summary?.streakDays ?? 0;
  const chipMono = { fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600 as const, borderRadius: 999, padding: "3px 9px" };

  return (
    <main className="fade-in" style={{ padding: "30px 24px 60px", maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>Flashcards</div>
        <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 2 }}>Your daily spaced-repetition review — every due card, across all your courses.</div>
      </div>

      {/* Scope */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, color: "var(--ink3)", fontFamily: "var(--font-mono)" }}>SCOPE</span>
        <select
          value={courseId}
          onChange={(e) => { setCourseId(e.target.value); setChapterId("all"); }}
          style={{ fontSize: 12.5, height: 38, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--card)", color: "var(--ink)", cursor: "pointer", fontFamily: "inherit", minWidth: 220 }}
        >
          <option value="all">All courses</option>
          {summary?.courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={chapterId}
          onChange={(e) => setChapterId(e.target.value)}
          disabled={courseId === "all"}
          style={{ fontSize: 12.5, height: 38, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 10, background: courseId === "all" ? "var(--bg-sunk)" : "var(--card)", color: courseId === "all" ? "var(--ink3)" : "var(--ink)", cursor: courseId === "all" ? "not-allowed" : "pointer", fontFamily: "inherit", minWidth: 180 }}
        >
          <option value="all">All chapters</option>
          {summary?.chapters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--ink3)" }}>{due} card{due === 1 ? "" : "s"} in this scope</span>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 14 }}>{error}</p>}

      {loading && !summary ? (
        <div className="flash-hub-grid">
          <div className="dash-skeleton" style={{ height: 300 }} />
          <div className="dash-skeleton" style={{ height: 300 }} />
        </div>
      ) : (
        <div className="flash-hub-grid">
          {/* Left — stat + CTA, or caught-up */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, boxShadow: "var(--e2)", display: "flex", flexDirection: "column", gap: 18 }}>
            {due === 0 ? (
              <div style={{ textAlign: "center", padding: "18px 6px" }}>
                <div style={{ width: 60, height: 60, borderRadius: 999, background: "var(--bg-sunk)", color: "var(--progress)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 26, fontWeight: 700 }}>✓</div>
                <div style={{ fontSize: 19, fontWeight: 800 }}>Nothing due right now</div>
                <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink2)", marginTop: 6 }}>You&apos;ve cleared every due card in this scope. Nice discipline — come back when the next batch is scheduled.</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
                  <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -0.03 * 64, lineHeight: 0.82 }}>{due}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.25, color: "var(--ink3)", paddingBottom: 9 }}>cards due<br />today</div>
                  <div style={{ flex: 1 }} />
                  {streak > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", background: "var(--orange-soft)", color: "var(--orange-deep)", borderRadius: 999, padding: "6px 12px", alignSelf: "flex-start" }}>🔥 {streak}-day</span>
                  )}
                </div>

                <button
                  onClick={startReview}
                  disabled={starting}
                  style={{ fontSize: 15, fontWeight: 600, width: "100%", height: 48, background: "var(--orange)", color: "#fff", border: "none", borderRadius: 12, cursor: starting ? "wait" : "pointer", boxShadow: "0 2px 8px rgba(242,106,27,.3)", fontFamily: "inherit" }}
                >
                  {starting ? "Starting…" : `Start review · ${sessionSize} card${sessionSize === 1 ? "" : "s"} →`}
                </button>

                {/* session size */}
                <div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color: "var(--ink3)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>SESSION SIZE</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {LIMITS.map((v) => {
                      const on = limit === v;
                      return (
                        <button
                          key={v}
                          onClick={() => setLimit(v)}
                          style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 15px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${on ? "var(--orange)" : "var(--line)"}`, background: on ? "var(--orange-soft)" : "var(--card)", color: on ? "var(--orange-deep)" : "var(--ink2)" }}
                        >
                          {v === "all" ? "All" : v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* collection bar (global) */}
            {collectionTotal > 0 && (
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, color: "var(--ink3)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
                  ACROSS YOUR COLLECTION · {collectionTotal} CARDS
                </div>
                <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "var(--line2)" }}>
                  <div style={{ flexGrow: col!.new, background: "var(--purple-ink)" }} />
                  <div style={{ flexGrow: col!.learning, background: "var(--amber-ink)" }} />
                  <div style={{ flexGrow: col!.known, background: "var(--progress)" }} />
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ ...chipMono, background: "var(--purple-soft)", color: "var(--purple-ink)" }}>{col!.new} NEW</span>
                  <span style={{ ...chipMono, background: "var(--amber-soft)", color: "var(--amber-ink)" }}>{col!.learning} LEARNING</span>
                  <span style={{ ...chipMono, background: "var(--green-soft)", color: "var(--green)" }}>{col!.known} KNOWN</span>
                </div>
              </div>
            )}

            {/* stats */}
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink2)" }}>{summary?.reviewedToday ?? 0}</div>
                <div style={{ fontSize: 11, color: "var(--ink3)" }}>reviewed today</div>
              </div>
              <div style={{ width: 1, height: 30, background: "var(--line)" }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--progress)" }}>{streak}</div>
                <div style={{ fontSize: 11, color: "var(--ink3)" }}>day streak</div>
              </div>
            </div>
          </div>

          {/* Right — breakdown */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden", boxShadow: "var(--e2)" }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--line2)" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{summary?.breakdown.groupBy === "chapter" ? "By chapter" : "By course"}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 2 }}>
                {summary?.breakdown.groupBy === "chapter" ? "Chapters with cards due" : "Cards drawn from every enrolled course"}
              </div>
            </div>
            {(summary?.breakdown.rows.length ?? 0) === 0 ? (
              <p style={{ padding: "18px 20px", fontSize: 13, color: "var(--ink3)" }}>No cards due in this scope.</p>
            ) : (
              summary!.breakdown.rows.map((r) => (
                <div key={r.id} className="forum-thread-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid var(--line2)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 2 }}>{r.ctx}</div>
                    <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, background: "var(--purple-soft)", color: "var(--purple-ink)", borderRadius: 5, padding: "2px 7px" }}>{r.new} NEW</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, background: "var(--amber-soft)", color: "var(--amber-ink)", borderRadius: 5, padding: "2px 7px" }}>{r.learning} LRN</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, background: "var(--green-soft)", color: "var(--green)", borderRadius: 5, padding: "2px 7px" }}>{r.known} KNW</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flex: "none" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--orange-deep)" }}>{r.due}</div>
                    <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: 1.2, color: "var(--ink3)", fontFamily: "var(--font-mono)" }}>DUE</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </main>
  );
}
