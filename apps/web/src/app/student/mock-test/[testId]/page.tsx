"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { testsApi, testAttemptsApi, ApiError, type TestTree, type TestAttempt, type TestAttemptResult } from "@/lib/api";
import ProgressRing from "@/components/ProgressRing";

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
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const submittingRef = useRef(false);

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
        setView("results");
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
    return (
      <main className="fade-in-up" style={{ padding: "40px 30px", maxWidth: 680, margin: "0 auto" }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 34 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--orange)", textTransform: "uppercase" }}>Mock Test</div>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.4, margin: "6px 0 4px" }}>{test.title}</div>

          {error && <p style={{ color: "var(--red)", fontSize: 13, margin: "10px 0" }}>{error}</p>}

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
              <div style={{ fontSize: 17, fontWeight: 800 }}>{test.testQuestions.length}</div>
            </div>
          </div>

          <ul style={{ fontSize: 13.5, lineHeight: 1.9, color: "var(--ink2)", paddingLeft: 18 }}>
            <li>Each question carries 1 mark — there is no negative marking.</li>
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
    return (
      <main className="fade-in" style={{ padding: "26px 30px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)" }}>
                Question {current + 1} of {questions.length}
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
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--orange)", textTransform: "uppercase", marginBottom: 12 }}>
                  {q.type === "MCQ" ? "Multiple Choice" : q.type === "TRUE_FALSE" ? "True / False" : "Fill in the blank"}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5, marginBottom: 22 }} dangerouslySetInnerHTML={{ __html: q.prompt }} />

                {q.type === "FILL_BLANK" ? (
                  <input
                    value={answers[q.id] ?? ""}
                    onChange={(e) => onSelectAnswer(q.id, e.target.value)}
                    placeholder="Type your answer…"
                    style={{ width: "100%", padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontFamily: "inherit", outline: "none", background: "var(--bg)" }}
                  />
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {q.options.map((opt) => {
                      const selected = answers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => onSelectAnswer(q.id, opt)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "14px 16px",
                            borderRadius: 12,
                            border: selected ? "1.5px solid var(--orange)" : "1.5px solid var(--line)",
                            background: selected ? "var(--orange-soft)" : "var(--card)",
                            color: selected ? "var(--orange)" : "var(--ink)",
                            fontSize: 14,
                            fontWeight: selected ? 700 : 500,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
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
                const answered = !!answers[qq.id];
                const active = i === current;
                return (
                  <button
                    key={qq.id}
                    onClick={() => setCurrent(i)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      border: active ? "2px solid var(--ink)" : "1px solid var(--line)",
                      background: answered ? "var(--green-soft)" : "var(--card)",
                      color: answered ? "var(--green)" : "var(--ink2)",
                      fontSize: 12.5,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "grid", gap: 6, marginTop: 16, fontSize: 11.5, color: "var(--ink2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--green-soft)", border: "1px solid var(--green)" }} /> Answered
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--card)", border: "1px solid var(--line)" }} /> Not visited
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (view === "results" && result) {
    const pct = result.maxScore ? (result.score ?? 0) / result.maxScore : 0;
    const correct = result.answers.filter((a) => a.isCorrect).length;
    const wrong = result.answers.filter((a) => a.isCorrect === false).length;
    const skipped = (result.maxScore ?? 0) - result.answers.length;
    return (
      <main className="fade-in-up" style={{ padding: "40px 30px", maxWidth: 840, margin: "0 auto" }}>
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
