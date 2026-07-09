"use client";

import { useEffect, useState } from "react";
import { enrollmentsApi, coursesApi, workoutApi, ApiError, type Enrollment, type Chapter, type Question, type QuestionType } from "@/lib/api";
import ProgressRing from "@/components/ProgressRing";

const FORMATS: { type: QuestionType; label: string }[] = [
  { type: "MCQ", label: "MCQ" },
  { type: "TRUE_FALSE", label: "True / False" },
  { type: "FILL_BLANK", label: "Fill in Blank" },
  { type: "ESSAY", label: "Short Answer" },
];

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  border: "1px solid var(--line)",
  borderRadius: 11,
  fontSize: 13.5,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
  color: "var(--ink)",
  width: "100%",
};

function normalize(v: string) {
  return v.trim().toLowerCase();
}

const QUESTION_COUNTS = [5, 10, 15, 20, 30];

/** Shared header: title + "Ungraded practice" badge + 3-step progress dots (setup → session → done). */
function StepHeader({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Workout</div>
      <span style={{ fontSize: 10.5, fontWeight: 600, background: "var(--green-soft)", color: "var(--green)", borderRadius: 999, padding: "4px 10px" }}>Ungraded practice</span>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            style={{
              width: n === step ? 20 : 8,
              height: 8,
              borderRadius: 999,
              background: n === step ? "var(--orange)" : n < step ? "var(--orange-bright)" : "var(--line)",
              transition: "all .2s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function StudentWorkoutPage() {
  const [view, setView] = useState<"dashboard" | "session" | "done">("dashboard");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [courseId, setCourseId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<QuestionType[]>(["MCQ"]);
  const [includeComprehension, setIncludeComprehension] = useState(false);
  const [count, setCount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [attempted, setAttempted] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    enrollmentsApi.mine().then(setEnrollments).catch(() => {});
  }, []);

  useEffect(() => {
    if (!courseId) {
      setChapters([]);
      setChapterId("");
      return;
    }
    coursesApi.get(courseId).then((c) => setChapters(c.chapters)).catch(() => {});
  }, [courseId]);

  function toggleFormat(type: QuestionType) {
    setSelectedFormats((f) => (f.includes(type) ? f.filter((t) => t !== type) : [...f, type]));
  }

  async function onStartWorkout() {
    if (!courseId || (selectedFormats.length === 0 && !includeComprehension)) return;
    setStarting(true);
    setError(null);
    try {
      const qs = await workoutApi.getQuestions(courseId, { chapterId: chapterId || undefined, types: selectedFormats, count, comprehension: includeComprehension });
      if (qs.length === 0) {
        setError("No questions match your selected format(s) for this course yet.");
        return;
      }
      setQuestions(qs);
      setIndex(0);
      setAnswer("");
      setRevealed(false);
      setAttempted(0);
      setCorrectCount(0);
      setView("session");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate workout");
    } finally {
      setStarting(false);
    }
  }

  function onReveal() {
    const q = questions[index];
    if (!q) return;
    setRevealed(true);
    setAttempted((a) => a + 1);
    if (q.type !== "ESSAY") {
      const isCorrect = normalize(answer) === normalize(q.correctOption ?? "");
      if (isCorrect) setCorrectCount((c) => c + 1);
    }
  }

  function onNext() {
    if (index + 1 >= questions.length) {
      setView("done");
      return;
    }
    setIndex((i) => i + 1);
    setAnswer("");
    setRevealed(false);
  }

  if (view === "session") {
    const q = questions[index];
    const isCorrect = q && q.type !== "ESSAY" ? normalize(answer) === normalize(q.correctOption ?? "") : null;
    return (
      <main className="fade-in mobile-page-pad" style={{ padding: "26px 30px", maxWidth: 720, margin: "0 auto" }}>
        <StepHeader step={2} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", background: "var(--line2)", borderRadius: 7, padding: "5px 10px", flex: "none" }}>
            Q {index + 1}/{questions.length}
          </span>
          <div style={{ flex: 1, height: 6, background: "var(--line2)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${((index + 1) / questions.length) * 100}%`, height: "100%", background: "var(--orange)", borderRadius: 999, transition: "width .3s ease" }} />
          </div>
          <button onClick={() => setView("dashboard")} style={{ background: "none", border: "none", color: "var(--ink3)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flex: "none" }}>
            End session
          </button>
        </div>

        {q && (
          <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 30 }}>
            {q.passage && (
              <div style={{ marginBottom: 18, padding: 16, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12, maxHeight: 260, overflowY: "auto" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: "var(--purple)", textTransform: "uppercase", marginBottom: 8 }}>📖 Passage</div>
                {q.passage.imageUrl && <img src={q.passage.imageUrl} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 10 }} />}
                <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink2)", whiteSpace: "pre-wrap" }}>{q.passage.text}</div>
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--orange)", textTransform: "uppercase", marginBottom: 12 }}>
              {q.passage ? "Comprehension" : FORMATS.find((f) => f.type === q.type)?.label}
            </div>
            {(q.difficulty !== "MEDIUM" || (q.tags?.length ?? 0) > 0) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, alignItems: "center" }}>
                {q.difficulty !== "MEDIUM" && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 7,
                      color: q.difficulty === "EASY" ? "var(--green)" : "var(--red)",
                      background: q.difficulty === "EASY" ? "var(--green-soft)" : "var(--red-soft)",
                    }}
                  >
                    {q.difficulty === "EASY" ? "Easy" : "Hard"}
                  </span>
                )}
                {(q.tags ?? []).map((t) => (
                  <span key={t.id} style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", background: "var(--orange-soft)", padding: "3px 9px", borderRadius: 7 }}>
                    {t.name}
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5, marginBottom: 22 }} dangerouslySetInnerHTML={{ __html: q.prompt }} />

            {q.type === "MCQ" || q.type === "TRUE_FALSE" ? (
              <div style={{ display: "grid", gap: 12 }}>
                {(q.type === "TRUE_FALSE" ? ["true", "false"] : q.options).map((opt) => {
                  const selected = answer === opt;
                  const showFeedback = revealed && (selected || opt === q.correctOption);
                  const correct = opt === q.correctOption;
                  return (
                    <button
                      key={opt}
                      disabled={revealed}
                      onClick={() => setAnswer(opt)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: showFeedback ? `1.5px solid ${correct ? "var(--green)" : "var(--red)"}` : selected ? "1.5px solid var(--orange)" : "1.5px solid var(--line)",
                        background: showFeedback ? (correct ? "var(--green-soft)" : "var(--red-soft)") : selected ? "var(--orange-soft)" : "var(--card)",
                        color: showFeedback ? (correct ? "var(--green)" : "var(--red)") : selected ? "var(--orange)" : "var(--ink)",
                        fontSize: 14,
                        fontWeight: selected || showFeedback ? 700 : 500,
                        fontFamily: "inherit",
                        cursor: revealed ? "default" : "pointer",
                        textAlign: "left",
                        textTransform: q.type === "TRUE_FALSE" ? "capitalize" : "none",
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : q.type === "FILL_BLANK" ? (
              <input
                value={answer}
                disabled={revealed}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer…"
                style={inputStyle}
              />
            ) : (
              <textarea
                value={answer}
                disabled={revealed}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Write your answer…"
                style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
              />
            )}

            {revealed && q.type !== "ESSAY" && (
              <div
                style={{
                  marginTop: 20,
                  padding: "14px 16px",
                  background: isCorrect ? "var(--green-soft)" : "var(--red-soft)",
                  borderRadius: 12,
                  fontSize: 13.5,
                  color: isCorrect ? "var(--green)" : "var(--red)",
                  fontWeight: 600,
                }}
              >
                {isCorrect ? "✓ Correct!" : `✕ Not quite — correct answer: ${q.correctOption}`}
              </div>
            )}
            {revealed && q.type === "ESSAY" && (
              <div style={{ marginTop: 14, padding: "13px 16px", background: "var(--orange-soft)", borderRadius: 11, fontSize: 12.5, color: "var(--ink2)" }}>
                ★ Short-answer questions aren&apos;t auto-graded — compare your answer with the lesson material yourself.
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              {!revealed ? (
                <button
                  onClick={onReveal}
                  disabled={!answer.trim()}
                  style={{ padding: "12px 24px", background: "var(--ink)", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: !answer.trim() ? 0.6 : 1 }}
                >
                  Check answer
                </button>
              ) : (
                <button
                  onClick={onNext}
                  style={{ padding: "12px 24px", background: "var(--orange)", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
                >
                  {index + 1 >= questions.length ? "Finish" : "Next question"}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    );
  }

  if (view === "done") {
    const gradable = questions.filter((q) => q.type !== "ESSAY").length;
    const pct = gradable > 0 ? correctCount / gradable : 0;
    return (
      <main className="fade-in-up mobile-page-pad" style={{ padding: "30px 30px 60px", maxWidth: 620, margin: "0 auto" }}>
        <StepHeader step={3} />
        <div style={{ display: "flex", gap: 24, alignItems: "center", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24 }}>
          <div style={{ position: "relative", width: 96, height: 96, flex: "none" }}>
            <ProgressRing pct={pct} color="var(--green)" size={96} strokeWidth={9} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{Math.round(pct * 100)}%</div>
              <div style={{ fontSize: 9, fontWeight: 500, color: "var(--ink3)" }}>correct</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Nice reps 💪</div>
            <p style={{ color: "var(--ink2)", fontSize: 13, lineHeight: 1.6, margin: "4px 0 14px" }}>
              You attempted <b>{attempted} of {questions.length}</b> · <b style={{ color: "var(--green)" }}>{correctCount} correct</b>
              {gradable < questions.length ? ` (${questions.length - gradable} short-answer not auto-graded)` : ""}.
            </p>
            <button
              onClick={() => setView("dashboard")}
              style={{ padding: "0 16px", height: 36, background: "var(--orange)", color: "#fff", border: "none", borderRadius: 9, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
            >
              New session
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="fade-in mobile-page-pad" style={{ padding: "30px 30px 60px", maxWidth: 720, margin: "0 auto" }}>
      <StepHeader step={1} />

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 26 }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>Build a session</div>
        <p style={{ fontSize: 13, color: "var(--ink3)", margin: "4px 0 22px" }}>Quick reps from your syllabus — no marks, no timer pressure.</p>

        <div className="mobile-stack-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)" }}>Course</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ ...inputStyle, marginTop: 7 }}>
              <option value="">Select a course…</option>
              {enrollments.map((e) => (
                <option key={e.courseId} value={e.courseId}>
                  {e.course.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)" }}>Chapter</label>
            <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} style={{ ...inputStyle, marginTop: 7 }} disabled={!courseId}>
              <option value="">All chapters</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)" }}>Question format</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 20px" }}>
          {FORMATS.map(({ type, label }) => {
            const active = selectedFormats.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleFormat(type)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  border: active ? "1px solid var(--orange)" : "1px solid var(--line)",
                  background: active ? "var(--orange-soft)" : "var(--card)",
                  color: active ? "var(--orange)" : "var(--ink2)",
                }}
              >
                {label}
              </button>
            );
          })}
          <button
            onClick={() => setIncludeComprehension((v) => !v)}
            title="Include comprehension passages and their questions"
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
              border: includeComprehension ? "1px solid var(--purple)" : "1px solid var(--line)",
              background: includeComprehension ? "var(--purple-soft)" : "var(--card)",
              color: includeComprehension ? "var(--purple)" : "var(--ink2)",
            }}
          >
            📖 Comprehension
          </button>
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)" }}>Number of questions</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 22px" }}>
          {QUESTION_COUNTS.map((n) => {
            const active = count === n;
            return (
              <button
                key={n}
                onClick={() => setCount(n)}
                style={{
                  minWidth: 46,
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  border: active ? "1px solid var(--orange)" : "1px solid var(--line)",
                  background: active ? "var(--orange-soft)" : "var(--card)",
                  color: active ? "var(--orange)" : "var(--ink2)",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 14 }}>{error}</p>}

        <button
          onClick={onStartWorkout}
          disabled={!courseId || (selectedFormats.length === 0 && !includeComprehension) || starting}
          style={{
            padding: "0 26px",
            height: 46,
            background: "var(--orange)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(242,106,27,.3)",
            opacity: !courseId || (selectedFormats.length === 0 && !includeComprehension) || starting ? 0.6 : 1,
          }}
        >
          {starting ? "Generating…" : "Start practicing →"}
        </button>
      </div>
    </main>
  );
}
