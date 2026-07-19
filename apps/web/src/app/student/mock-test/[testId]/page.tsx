"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { testsApi, testAttemptsApi, ApiError, type TestTree, type TestAttempt, type TestAttemptResult, type Leaderboard, type AttemptReview } from "@/lib/api";
import ProgressRing from "@/components/ProgressRing";

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase();
}

const btnStyle: React.CSSProperties = {
  padding: "11px 20px",
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
  color: "var(--ink)",
};

type View = "loading" | "instructions" | "taking" | "results" | "error";

function formatTime(seconds: number) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  MCQ: "Multiple choice",
  TRUE_FALSE: "True / False",
  FILL_BLANK: "Fill in the blank",
};

function classifyQuestion(q: { type: string; hasPassage: boolean }) {
  return q.hasPassage ? "Comprehension" : QUESTION_TYPE_LABELS[q.type] ?? q.type;
}

type HighlightRange = { start: number; end: number };

/** Sums text-node lengths up to (node, offset) within container — gives a stable plain-text character offset
 *  even though highlighted spans split the passage across multiple DOM text nodes. */
function getTextOffset(container: Node, node: Node, offset: number): number {
  let total = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return total;
}

function renderHighlightedText(text: string, ranges: HighlightRange[], onRemove: (index: number) => void) {
  if (ranges.length === 0) return text;
  const ordered = ranges.map((r, i) => ({ ...r, i })).sort((a, b) => a.start - b.start);
  const nodes: React.ReactNode[] = [];
  let pos = 0;
  for (const r of ordered) {
    if (r.start > pos) nodes.push(text.slice(pos, r.start));
    nodes.push(
      <mark
        key={r.i}
        onClick={() => onRemove(r.i)}
        title="Click to remove highlight"
        style={{ background: "#fde08d", cursor: "pointer", borderRadius: 2 }}
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    pos = Math.max(pos, r.end);
  }
  if (pos < text.length) nodes.push(text.slice(pos));
  return nodes;
}

function PassagePanel({
  passage,
  highlights,
  onAddHighlight,
  onRemoveHighlight,
}: {
  passage: { id: string; text: string; imageUrl: string | null };
  highlights: HighlightRange[];
  onAddHighlight: (range: HighlightRange) => void;
  onRemoveHighlight: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  function onMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) return;
    const range = sel.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) return;
    const start = getTextOffset(containerRef.current, range.startContainer, range.startOffset);
    const end = getTextOffset(containerRef.current, range.endContainer, range.endOffset);
    sel.removeAllRanges();
    if (end > start) onAddHighlight({ start: Math.min(start, end), end: Math.max(start, end) });
  }

  return (
    <div
      className="mock-test-passage"
      style={{
        position: "sticky",
        top: 20,
        alignSelf: "start",
        maxHeight: "calc(100vh - 60px)",
        overflowY: "auto",
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--rl)",
        padding: 22,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--orange)", textTransform: "uppercase", marginBottom: 12 }}>
        Passage
      </div>
      {passage.imageUrl && (
        <img src={passage.imageUrl} alt="" style={{ width: "100%", borderRadius: 10, marginBottom: 14 }} />
      )}
      <div
        ref={containerRef}
        onMouseUp={onMouseUp}
        style={{ fontSize: 13.5, lineHeight: 1.8, color: "var(--ink2)", whiteSpace: "pre-wrap", userSelect: "text" }}
      >
        {renderHighlightedText(passage.text, highlights, onRemoveHighlight)}
      </div>
      <p style={{ fontSize: 11, color: "var(--ink3)", marginTop: 12 }}>Select any text above to highlight it for reference.</p>
    </div>
  );
}

export default function StudentMockTestTakePage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params.testId;

  const [view, setView] = useState<View>("loading");
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<TestTree | null>(null);
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<TestAttemptResult | null>(null);
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | "wrong" | "skipped">("all");
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState<number | null>(null);
  const [highlights, setHighlights] = useState<Record<string, HighlightRange[]>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const submittingRef = useRef(false);

  function toggleMark(testQuestionId: string) {
    setMarked((m) => {
      const next = new Set(m);
      if (next.has(testQuestionId)) next.delete(testQuestionId);
      else next.add(testQuestionId);
      return next;
    });
  }

  function addHighlight(passageId: string, range: HighlightRange) {
    setHighlights((h) => ({ ...h, [passageId]: [...(h[passageId] ?? []), range] }));
  }
  function removeHighlight(passageId: string, index: number) {
    setHighlights((h) => ({ ...h, [passageId]: (h[passageId] ?? []).filter((_, i) => i !== index) }));
  }

  useEffect(() => {
    setView("loading");
    testsApi
      .get(testId)
      .then((t) => {
        setTest(t);
        setView("instructions");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load mock test");
        setView("error");
      });
  }, [testId]);

  const questions = attempt?.testQuestions ?? [];

  /** "1", "2", "3-a", "3-b", ... -- comprehension sub-questions are lettered relative to their passage instead of getting their own flat number. */
  const questionLabels = useMemo(() => {
    const labels: string[] = [];
    const passageNumbers = new Map<string, number>();
    const passageLetterIndex = new Map<string, number>();
    let flatNumber = 0;
    let nextPassageNumber = 0;
    for (const q of questions) {
      if (q.passage) {
        let passageNumber = passageNumbers.get(q.passage.id);
        if (passageNumber === undefined) {
          passageNumber = ++nextPassageNumber;
          passageNumbers.set(q.passage.id, passageNumber);
        }
        const letterIndex = passageLetterIndex.get(q.passage.id) ?? 0;
        passageLetterIndex.set(q.passage.id, letterIndex + 1);
        labels.push(`${passageNumber}-${String.fromCharCode(97 + letterIndex)}`);
      } else {
        labels.push(`${++flatNumber}`);
      }
    }
    return labels;
  }, [questions]);

  async function onStart() {
    try {
      const a = await testAttemptsApi.start(testId);
      setAttempt(a);
      setAnswers({});
      setCurrent(0);
      if (test?.publishMode === "TIMED" && test.durationMinutes) {
        setSecondsLeft(test.durationMinutes * 60);
      } else {
        setSecondsLeft(null);
      }
      setView("taking");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start attempt");
    }
  }

  const onSubmit = useMemo(
    () => async () => {
      if (!attempt || submittingRef.current) return;
      submittingRef.current = true;
      try {
        const res = await testAttemptsApi.submit(attempt.id);
        setResult(res);
        setReview(null);
        setView("results");
        testAttemptsApi.review(attempt.id).then(setReview).catch(() => {});
        testAttemptsApi.leaderboard(testId).then(setLeaderboard).catch(() => {});
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to submit attempt");
      } finally {
        submittingRef.current = false;
      }
    },
    [attempt],
  );

  useEffect(() => {
    if (secondsLeft === null || view !== "taking") return;
    if (secondsLeft <= 0) {
      onSubmit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, view, onSubmit]);

  // Soft per-question suggested-time countdown — guidance only. It never auto-advances, locks,
  // or submits; it just resets to the current question's answerTimeSeconds when the question changes.
  useEffect(() => {
    if (view !== "taking") return;
    setQuestionSecondsLeft(attempt?.testQuestions?.[current]?.answerTimeSeconds ?? null);
  }, [current, view, attempt]);

  useEffect(() => {
    if (view !== "taking" || questionSecondsLeft === null || questionSecondsLeft <= 0) return;
    const t = setTimeout(() => setQuestionSecondsLeft((s) => (s !== null && s > 0 ? s - 1 : s)), 1000);
    return () => clearTimeout(t);
  }, [questionSecondsLeft, view]);

  async function onSelectAnswer(testQuestionId: string, selectedOption: string) {
    if (!attempt) return;
    setAnswers((a) => ({ ...a, [testQuestionId]: selectedOption }));
    try {
      await testAttemptsApi.saveAnswer(attempt.id, testQuestionId, selectedOption);
    } catch {
      // autosave failures are non-fatal — the answer is still selected locally and re-sent on next change
    }
  }

  if (view === "loading") return <main style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></main>;
  if (view === "error" || !test) return <main style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error}</p></main>;

  if (view === "instructions") {
    const totalMarks = test.testQuestions.reduce((sum, q) => sum + (q.marks ?? 1), 0);
    const uniformOneMark = test.testQuestions.every((q) => (q.marks ?? 1) === 1);
    const hasNegative = test.testQuestions.some((q) => (q.negativeMarks ?? 0) > 0);
    const marksNote =
      uniformOneMark && !hasNegative
        ? "Each question carries 1 mark — there is no negative marking."
        : `Questions carry different marks (${totalMarks} in total) — each question shows its own marks. ${hasNegative ? "Wrong answers deduct negative marks." : "There is no negative marking."}`;
    return (
      <main className="fade-in-up mobile-page-pad" style={{ padding: "40px 30px", maxWidth: 680, margin: "0 auto" }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 34 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--orange)", textTransform: "uppercase" }}>Mock Test</div>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.4, margin: "6px 0 4px" }}>{test.title}</div>

          {error && (
            <div style={{ margin: "10px 0" }}>
              <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>
              {error.toLowerCase().includes("subscription") && (
                <Link href="/student/subscription" style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
                  View subscription plans →
                </Link>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 14, margin: "20px 0", flexWrap: "wrap" }}>
            <div style={{ background: "var(--bg)", borderRadius: 12, padding: "14px 20px", flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--ink3)" }}>DURATION</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{test.durationMinutes ? `${test.durationMinutes} min` : "Untimed"}</div>
            </div>
            <div style={{ background: "var(--bg)", borderRadius: 12, padding: "14px 20px", flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--ink3)" }}>QUESTIONS</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{test.testQuestions.length}</div>
            </div>
            <div style={{ background: "var(--bg)", borderRadius: 12, padding: "14px 20px", flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--ink3)" }}>MARKS</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{totalMarks}</div>
            </div>
          </div>

          <ul style={{ fontSize: 13.5, lineHeight: 1.9, color: "var(--ink2)", paddingLeft: 18 }}>
            <li>{marksNote}</li>
            <li>You need <b>{test.passPercent}%</b> or above to pass this test.</li>
            <li>You can navigate between questions freely before submitting.</li>
            <li>{test.publishMode === "TIMED" ? "The test auto-submits when the timer runs out." : "There is no time limit for this attempt."}</li>
            <li>You can retake this mock test as many times as you like — your best score is kept.</li>
          </ul>

          <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
            <button onClick={() => router.push("/student/mock-test")} style={btnStyle}>
              Back
            </button>
            <button onClick={onStart} style={{ ...btnStyle, background: "var(--ink)", color: "#fff", border: "none", flex: 1 }}>
              Start Test
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (view === "taking" && attempt) {
    const q = questions[current];
    const answeredCount = questions.filter((qq) => answers[qq.id] !== undefined).length;
    const totalSeconds = test?.publishMode === "TIMED" && test.durationMinutes ? test.durationMinutes * 60 : null;
    return (
      <main className="fade-in mobile-page-pad" style={{ padding: "26px 30px", maxWidth: q?.passage ? 1480 : 1100, margin: "0 auto" }}>
        <div className="mobile-stack-grid" style={{ display: "grid", gridTemplateColumns: q?.passage ? "400px 1fr 260px" : "1fr 260px", gap: 20 }}>
          {q?.passage && (
            <PassagePanel
              passage={q.passage}
              highlights={highlights[q.passage.id] ?? []}
              onAddHighlight={(range) => addHighlight(q.passage!.id, range)}
              onRemoveHighlight={(index) => removeHighlight(q.passage!.id, index)}
            />
          )}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{test?.title ?? "Mock Test"}</span>
                {q?.passage && (
                  <span style={{ fontSize: 10.5, fontWeight: 600, background: "var(--bg-sunk)", color: "var(--ink2)", borderRadius: 999, padding: "4px 10px", flex: "none" }}>Comprehension</span>
                )}
              </div>
              {secondsLeft !== null && (
                <div style={{ background: "var(--ink)", color: "#fff", padding: "9px 16px", borderRadius: 11, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                  {formatTime(secondsLeft)}
                </div>
              )}
            </div>

            {q && (
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 30 }}>
                {/* S3 meta row: Q x/N · difficulty · +marks / −neg · avg time */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.08 * 10, fontFamily: "var(--font-mono)", background: "var(--bg-sunk)", color: "var(--ink2)", borderRadius: 6, padding: "4px 8px" }}>
                    Q {questionLabels[current]} / {questions.length}
                  </span>
                  {(() => {
                    const d = q.difficulty;
                    const meta = d === "EASY"
                      ? { label: "Easy", bg: "var(--diff-easy-soft)", ink: "var(--diff-easy)" }
                      : d === "HARD"
                      ? { label: "Hard", bg: "var(--diff-hard-soft)", ink: "var(--diff-hard)" }
                      : { label: "Medium", bg: "var(--diff-med-soft)", ink: "var(--diff-med)" };
                    return (
                      <span style={{ fontSize: 11, fontWeight: 600, background: meta.bg, color: meta.ink, borderRadius: 999, padding: "4px 10px" }}>{meta.label}</span>
                    );
                  })()}
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", background: "var(--green-soft)", color: "var(--green)", borderRadius: 6, padding: "4px 8px" }}>
                    +{q.marks.toFixed(1)}
                  </span>
                  {q.negativeMarks > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", background: "var(--red-soft)", color: "var(--red-ink)", borderRadius: 6, padding: "4px 8px" }}>
                      −{q.negativeMarks.toFixed(1)}
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  {q.answerTimeSeconds != null && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink3)" }}>avg. time on this Q: {formatTime(q.answerTimeSeconds)}</span>
                  )}
                  {q.tags.length > 0 && q.tags.slice(0, 2).map((t) => (
                    <span key={t.id} style={{ fontSize: 10.5, fontWeight: 700, color: "var(--orange-ink)", background: "var(--orange-soft)", padding: "3px 9px", borderRadius: 7 }}>
                      {t.name}
                    </span>
                  ))}
                </div>
                {q.answerTimeSeconds != null && questionSecondsLeft != null && (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: questionSecondsLeft > 0 ? "var(--ink3)" : "var(--amber)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                    {questionSecondsLeft > 0
                      ? `Suggested time: ${formatTime(questionSecondsLeft)}`
                      : "Suggested time's up — no penalty, take your time"}
                  </div>
                )}
                {q.imageUrl && <img src={q.imageUrl} alt="" style={{ width: "100%", maxHeight: 280, objectFit: "contain", borderRadius: 12, marginBottom: 18, background: "var(--bg)" }} />}
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5, marginBottom: 22 }} dangerouslySetInnerHTML={{ __html: q.prompt }} />

                {q.type === "FILL_BLANK" ? (
                  <input
                    value={answers[q.id] ?? ""}
                    onChange={(e) => onSelectAnswer(q.id, e.target.value)}
                    placeholder="Type your answer…"
                    style={{ width: "100%", padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontFamily: "inherit", outline: "none", background: "var(--bg)" }}
                  />
                ) : (
                  <div style={{ display: "grid", gap: 10, maxWidth: 620 }}>
                    {q.options.map((opt, oi) => {
                      const selected = answers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => onSelectAnswer(q.id, opt)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "13px 15px",
                            borderRadius: 12,
                            border: selected ? "1.5px solid var(--orange)" : "1.5px solid var(--line)",
                            background: selected ? "var(--orange-soft)" : "var(--card)",
                            color: selected ? "var(--orange-deep)" : "var(--ink)",
                            fontSize: 14.5,
                            fontWeight: selected ? 700 : 500,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          {/* S3 lettered key circle */}
                          <span
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 999,
                              flex: "none",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                              background: selected ? "var(--orange)" : "var(--bg-sunk)",
                              color: selected ? "#fff" : "var(--ink2)",
                            }}
                          >
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {q && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
                <button
                  onClick={() => toggleMark(q.id)}
                  style={{
                    ...btnStyle,
                    padding: "9px 16px",
                    fontSize: 12.5,
                    background: marked.has(q.id) ? "var(--purple-soft)" : "var(--card)",
                    color: marked.has(q.id) ? "var(--purple-ink)" : "var(--ink)",
                    border: marked.has(q.id) ? "1px solid var(--purple)" : "1px solid var(--line)",
                  }}
                >
                  {marked.has(q.id) ? "★ Marked for review" : "☆ Mark for review"}
                </button>
                {answers[q.id] !== undefined && (
                  <button
                    onClick={() => setAnswers((a) => { const next = { ...a }; delete next[q.id]; return next; })}
                    style={{ ...btnStyle, padding: "9px 16px", fontSize: 12.5 }}
                  >
                    Clear response
                  </button>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, flexWrap: "wrap", gap: 10 }}>
              <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} style={{ ...btnStyle, opacity: current === 0 ? 0.5 : 1 }}>
                Previous
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                {current < questions.length - 1 ? (
                  <button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))} style={btnStyle}>
                    Save &amp; Next
                  </button>
                ) : null}
                <button onClick={onSubmit} style={{ ...btnStyle, background: "var(--orange)", color: "#fff", border: "none" }}>
                  Submit Test
                </button>
              </div>
            </div>
            {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 12 }}>{error}</p>}
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 18, alignSelf: "start" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Question Palette</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {questions.map((qq, i) => {
                const answered = answers[qq.id] !== undefined;
                const isMarked = marked.has(qq.id);
                const active = i === current;
                return (
                  <button
                    key={qq.id}
                    onClick={() => setCurrent(i)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      // S3: solid green (answered) / purple (marked) / white (unanswered);
                      // the current question gets an ink ring on top.
                      border: active ? "2px solid var(--ink)" : isMarked || answered ? "none" : "1px solid var(--line)",
                      background: isMarked ? "var(--purple)" : answered ? "var(--progress)" : "var(--card)",
                      color: isMarked || answered ? "#fff" : "var(--ink2)",
                      fontSize: qq.passage ? 10.5 : 12.5,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    {questionLabels[i]}
                  </button>
                );
              })}
            </div>
            {/* S3 legend with live counts */}
            <div style={{ display: "grid", gap: 8, marginTop: 16, fontSize: 11, color: "var(--ink2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 11, height: 11, borderRadius: 4, background: "var(--progress)" }} /> Answered · {answeredCount}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 11, height: 11, borderRadius: 4, background: "var(--card)", border: "1px solid var(--line)", boxSizing: "border-box" }} /> Unanswered · {questions.length - answeredCount}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 11, height: 11, borderRadius: 4, background: "var(--purple)" }} /> Marked · {marked.size}
              </div>
            </div>

            {/* S3 section-time bar (timed tests only) */}
            {secondsLeft !== null && totalSeconds !== null && (
              <>
                <div style={{ height: 1, background: "var(--line2)", margin: "18px 0 14px" }} />
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.08 * 10, fontFamily: "var(--font-mono)", color: "var(--ink3)", marginBottom: 8 }}>SECTION TIME</div>
                <div style={{ height: 8, background: "var(--line2)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100))}%`, height: "100%", background: secondsLeft < totalSeconds * 0.15 ? "var(--red)" : "var(--orange)", borderRadius: 999, transition: "width 1s linear" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--ink2)", marginTop: 6 }}>
                  <span>{formatTime(secondsLeft)} left</span>
                  <span>{formatTime(totalSeconds)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (view === "results" && result) {
    const pct = result.maxScore ? (result.score ?? 0) / result.maxScore : 0;
    const passed = result.maxScore ? (result.score ?? 0) * 100 >= result.maxScore * test.passPercent : false;
    const correct = result.answers.filter((a) => a.isCorrect).length;
    const wrong = result.answers.filter((a) => a.isCorrect === false).length;
    const skipped = (result.maxScore ?? 0) - result.answers.length;

    const timeTaken = review?.timeTakenSeconds ?? null;
    const perQuestion = review && timeTaken != null && review.questions.length ? Math.round(timeTaken / review.questions.length) : null;
    const typeGroups = (() => {
      if (!review) return [] as { label: string; correct: number; total: number; pct: number }[];
      const map = new Map<string, { correct: number; total: number }>();
      for (const q of review.questions) {
        const key = classifyQuestion(q);
        const g = map.get(key) ?? { correct: 0, total: 0 };
        g.total += 1;
        if (q.isCorrect) g.correct += 1;
        map.set(key, g);
      }
      return [...map.entries()].map(([label, g]) => ({ label, correct: g.correct, total: g.total, pct: g.total ? (g.correct / g.total) * 100 : 0 }));
    })();
    return (
      <main className="fade-in-up mobile-page-pad" style={{ padding: "40px 30px", maxWidth: 840, margin: "0 auto" }}>
        <div
          style={{
            background: "linear-gradient(120deg,#15281d,#1f3b2a)",
            color: "#fff",
            borderRadius: "var(--rl)",
            padding: 34,
            display: "flex",
            gap: 30,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ position: "relative", width: 120, height: 120, flex: "none" }}>
            <ProgressRing pct={pct} color="#7fd3a4" size={120} strokeWidth={9} trackColor="rgba(255,255,255,.15)" />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 800 }}>{Math.round(pct * 100)}%</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", opacity: 0.7 }}>Result</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.4 }}>
              {result.score} / {result.maxScore} marks
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 8, padding: "5px 12px", borderRadius: 999, background: passed ? "rgba(127,211,164,.2)" : "rgba(255,138,128,.2)", fontSize: 12.5, fontWeight: 800 }}>
              <span style={{ color: passed ? "#7fd3a4" : "#ff8a80" }}>{passed ? "✓ Passed" : "✕ Not passed"}</span>
              <span style={{ opacity: 0.7, fontWeight: 600 }}>· pass mark {test.passPercent}%</span>
            </div>
            <div style={{ display: "flex", gap: 26, marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{correct}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Correct</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{wrong}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Wrong</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{skipped}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Skipped</div>
              </div>
            </div>
          </div>
        </div>

        {review && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 18 }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "16px 18px" }}>
              <div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600 }}>Time taken</div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, marginTop: 3 }}>{timeTaken != null ? formatDuration(timeTaken) : "—"}</div>
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "16px 18px" }}>
              <div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600 }}>Avg / question</div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, marginTop: 3 }}>{perQuestion != null ? formatDuration(perQuestion) : "—"}</div>
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "16px 18px" }}>
              <div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600 }}>Percentile</div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, marginTop: 3, color: "var(--orange)" }}>
                {review.totalStudents > 1 ? `Top ${Math.max(1, 100 - review.percentile)}%` : "—"}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink3)", marginTop: 2 }}>
                {review.totalStudents > 1 ? `of ${review.totalStudents} students` : "Be the first to set the bar"}
              </div>
            </div>
          </div>
        )}

        {typeGroups.length > 0 && (
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24, marginTop: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Accuracy by question type</div>
            <div style={{ display: "grid", gap: 14 }}>
              {typeGroups.map((g) => (
                <div key={g.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ fontWeight: 700 }}>{g.label}</span>
                    <span style={{ color: "var(--ink3)", fontWeight: 600 }}>{g.correct}/{g.total} · {Math.round(g.pct)}%</span>
                  </div>
                  <div style={{ height: 9, background: "var(--line2)", borderRadius: 6, overflow: "hidden" }}>
                    <div className="dash-bar-x" style={{ width: `${g.pct}%`, height: "100%", borderRadius: 6, background: g.pct >= 70 ? "var(--green)" : g.pct >= 40 ? "var(--orange)" : "var(--red)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {review && review.questions.length > 0 && (
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24, marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Question review</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>Your answer vs the correct answer for every question.</div>
              </div>
              {/* S3 review filter */}
              <div style={{ display: "flex", gap: 4, background: "var(--bg-sunk)", borderRadius: 10, padding: 4 }}>
                {(["all", "wrong", "skipped"] as const).map((f) => {
                  const count = f === "all" ? review.questions.length : f === "wrong" ? review.questions.filter((x) => x.answered && !x.isCorrect).length : review.questions.filter((x) => !x.answered).length;
                  return (
                    <span
                      key={f}
                      onClick={() => setReviewFilter(f)}
                      style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 7, cursor: "pointer", userSelect: "none", background: reviewFilter === f ? "var(--card)" : "transparent", color: reviewFilter === f ? "var(--ink)" : "var(--ink2)", boxShadow: reviewFilter === f ? "var(--e1)" : "none" }}
                    >
                      {f === "all" ? "All" : f === "wrong" ? "Wrong only" : "Skipped"} · {count}
                    </span>
                  );
                })}
              </div>
            </div>
            <div>
              {review.questions
                .map((q, origIndex) => ({ q, origIndex }))
                .filter(({ q }) => (reviewFilter === "all" ? true : reviewFilter === "wrong" ? q.answered && !q.isCorrect : !q.answered))
                .map(({ q, origIndex }, i) => {
                const tone = q.isCorrect ? "var(--green)" : q.answered ? "var(--red)" : "var(--ink3)";
                const toneSoft = q.isCorrect ? "var(--green-soft)" : q.answered ? "var(--red-soft)" : "var(--bg)";
                const awarded = q.isCorrect ? q.marks : q.answered ? -q.negativeMarks : 0;
                const awardedLabel = `${awarded > 0 ? "+" : ""}${awarded} / ${q.marks}`;
                return (
                  <div key={q.id} style={{ display: "flex", gap: 12, padding: "14px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, background: toneSoft, color: tone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flex: "none" }}>
                      {origIndex + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: q.prompt }} />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: tone, background: toneSoft, padding: "3px 10px", borderRadius: 7 }}>
                          You: {q.answered ? q.selectedOption : "Skipped"}
                        </span>
                        {!q.isCorrect && q.correctOption && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", background: "var(--green-soft)", padding: "3px 10px", borderRadius: 7 }}>
                            Correct: {q.correctOption}
                          </span>
                        )}
                        {q.tags.map((t) => (
                          <span key={t.id} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--orange)", background: "var(--orange-soft)", padding: "3px 10px", borderRadius: 7 }}>
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: tone }}>{q.isCorrect ? "✓" : q.answered ? "✗" : "—"}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: tone, whiteSpace: "nowrap" }}>{awardedLabel}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {leaderboard && leaderboard.top.length > 0 && (
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24, marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Leaderboard</div>
              <button
                onClick={() => router.push(`/student/mock-test/${testId}/leaderboard`)}
                style={{ background: "none", border: "none", color: "var(--orange-deep)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
              >
                Full leaderboard →
              </button>
            </div>
            <div style={{ display: "grid" }}>
              {[...leaderboard.top, ...(leaderboard.me ? [leaderboard.me] : [])].map((entry, i) => {
                const pctScore = entry.maxScore ? Math.round(((entry.score ?? 0) / entry.maxScore) * 100) : 0;
                const highlight = entry.isMe && entry.rank > leaderboard.top.length;
                return (
                  <div
                    key={entry.studentId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 10px",
                      borderTop: i ? "1px solid var(--line)" : "none",
                      background: highlight ? "var(--orange-soft)" : "transparent",
                      margin: highlight ? "8px 0 0" : 0,
                      borderRadius: highlight ? 10 : 0,
                    }}
                  >
                    <span style={{ width: 30, fontSize: 13, fontWeight: 800, color: entry.rank <= 3 ? "var(--orange)" : "var(--ink3)" }}>#{entry.rank}</span>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>
                      {initials(entry.studentName)}
                    </div>
                    <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>
                      {entry.studentName}
                      {entry.isMe && <span style={{ color: "var(--ink3)", fontWeight: 600 }}> (You)</span>}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{pctScore}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 26 }}>
          <button onClick={onStart} style={{ ...btnStyle, background: "var(--orange)", color: "#fff", border: "none" }}>
            Retake
          </button>
          <button onClick={() => router.push("/student/mock-test")} style={btnStyle}>
            Back to Mock Tests
          </button>
        </div>
      </main>
    );
  }

  return null;
}
