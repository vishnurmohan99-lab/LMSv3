"use client";

import { useEffect, useState } from "react";
import { feedbackApi, ApiError, type FeedbackForm, type FeedbackFormWithMyResponse } from "@/lib/api";

function targetName(f: FeedbackForm) {
  if (f.targetType === "COURSE") return f.targetCourse?.title ?? "—";
  if (f.targetType === "SYSTEM") return f.targetSystemArea ?? "—";
  return f.targetFaculty?.fullName ?? "—";
}

const TARGET_META: Record<string, { label: string; color: string; soft: string }> = {
  COURSE: { label: "COURSE", color: "var(--orange)", soft: "var(--orange-soft)" },
  FACULTY: { label: "FACULTY", color: "var(--blue)", soft: "var(--blue-soft)" },
  MENTOR: { label: "MENTOR", color: "var(--purple)", soft: "var(--purple-soft)" },
  SYSTEM: { label: "SYSTEM", color: "var(--green)", soft: "var(--green-soft)" },
};

function Stars({ value, onPick, size = 18 }: { value: number; onPick?: (n: number) => void; size?: number }) {
  return (
    <div style={{ display: "flex", gap: size > 20 ? 6 : 3 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type={onPick ? "button" : undefined}
          onClick={onPick ? () => onPick(n) : undefined}
          disabled={!onPick}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: onPick ? "pointer" : "default",
            fontSize: size,
            lineHeight: 1,
            color: n <= value ? "var(--orange)" : "var(--line)",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function StudentFeedbackPage() {
  const [tab, setTab] = useState<"allotted" | "submitted">("allotted");
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<FeedbackFormWithMyResponse | null>(null);
  const [answers, setAnswers] = useState<(string | number | string[])[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function loadForms() {
    setLoading(true);
    feedbackApi
      .listMine()
      .then(setForms)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load feedback forms"))
      .finally(() => setLoading(false));
  }

  useEffect(loadForms, []);

  function openFbForm(id: string) {
    setOpenFormId(id);
    setError(null);
    feedbackApi
      .getForFill(id)
      .then((f) => {
        setOpenForm(f);
        setAnswers(f.myResponse ? f.myResponse.answers : f.questions.map((q) => (q.type === "RATING" ? 0 : q.type === "CHECKBOXES" ? [] : "")));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load form"));
  }

  function setAnswer(i: number, value: string | number | string[]) {
    setAnswers((a) => a.map((x, idx) => (idx === i ? value : x)));
  }

  function toggleCheckboxOption(i: number, option: string) {
    setAnswers((a) =>
      a.map((x, idx) => {
        if (idx !== i) return x;
        const current = Array.isArray(x) ? x : [];
        return current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
      }),
    );
  }

  function isAnswerEmpty(value: string | number | string[] | undefined): boolean {
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null || String(value).trim() === "";
  }

  async function onSubmit() {
    if (!openForm) return;
    const missing = openForm.questions.find((q, i) => q.required && isAnswerEmpty(answers[i]));
    if (missing) {
      setError(`"${missing.label}" is required`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await feedbackApi.submit(openForm.id, answers);
      setOpenFormId(null);
      setOpenForm(null);
      loadForms();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  const allotted = forms.filter((f) => !f.submitted);
  const submitted = forms.filter((f) => f.submitted);
  const readOnly = !!openForm?.myResponse;

  if (openFormId) {
    return (
      <main className="fade-in" style={{ padding: "30px 30px 60px", maxWidth: 640, margin: "0 auto" }}>
        <button
          onClick={() => {
            setOpenFormId(null);
            setOpenForm(null);
          }}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", marginBottom: 18 }}
        >
          ← Back
        </button>
        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}
        {!openForm ? (
          <p style={{ color: "var(--ink2)" }}>Loading…</p>
        ) : (
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: "32px 34px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>{openForm.title}</div>
            <p style={{ fontSize: 13.5, color: "var(--ink3)", margin: "6px 0 26px" }}>Share your feedback about {targetName(openForm)}</p>
            {openForm.questions.map((q, qi) => (
              <div key={qi} style={{ marginBottom: 22 }}>
                <label style={{ fontSize: 13.5, fontWeight: 700, display: "block", marginBottom: 10 }}>
                  {q.label}
                  {q.required && <span style={{ color: "var(--red)" }}> *</span>}
                </label>
                {q.type === "RATING" ? (
                  <Stars value={Number(answers[qi]) || 0} onPick={readOnly ? undefined : (n) => setAnswer(qi, n)} size={32} />
                ) : q.type === "PARAGRAPH" ? (
                  <textarea
                    value={String(answers[qi] ?? "")}
                    readOnly={readOnly}
                    onChange={(e) => setAnswer(qi, e.target.value)}
                    placeholder="Share your thoughts…"
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      fontSize: 13.5,
                      fontFamily: "inherit",
                      outline: "none",
                      background: readOnly ? "var(--bg)" : "var(--card)",
                      minHeight: 100,
                      resize: "vertical",
                    }}
                  />
                ) : q.type === "MULTIPLE_CHOICE" ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {(q.options ?? []).map((opt) => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, cursor: readOnly ? "default" : "pointer" }}>
                        <input
                          type="radio"
                          name={`q-${qi}`}
                          checked={answers[qi] === opt}
                          disabled={readOnly}
                          onChange={() => setAnswer(qi, opt)}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : q.type === "CHECKBOXES" ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {(q.options ?? []).map((opt) => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, cursor: readOnly ? "default" : "pointer" }}>
                        <input
                          type="checkbox"
                          checked={Array.isArray(answers[qi]) && (answers[qi] as string[]).includes(opt)}
                          disabled={readOnly}
                          onChange={() => toggleCheckboxOption(qi, opt)}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : q.type === "DROPDOWN" ? (
                  <select
                    value={String(answers[qi] ?? "")}
                    disabled={readOnly}
                    onChange={(e) => setAnswer(qi, e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      fontSize: 13.5,
                      fontFamily: "inherit",
                      outline: "none",
                      background: readOnly ? "var(--bg)" : "var(--card)",
                    }}
                  >
                    <option value="">Select…</option>
                    {(q.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={String(answers[qi] ?? "")}
                    readOnly={readOnly}
                    onChange={(e) => setAnswer(qi, e.target.value)}
                    placeholder="Your answer"
                    style={{
                      width: "100%",
                      padding: "13px 16px",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      fontSize: 13.5,
                      fontFamily: "inherit",
                      outline: "none",
                      background: readOnly ? "var(--bg)" : "var(--card)",
                    }}
                  />
                )}
              </div>
            ))}
            {!readOnly ? (
              <>
                <button
                  onClick={onSubmit}
                  disabled={submitting}
                  style={{ width: "100%", marginTop: 4, padding: 15, background: "var(--ink)", color: "#fff", border: "none", borderRadius: 13, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? "Submitting…" : "Submit feedback"}
                </button>
                <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--ink3)", marginTop: 14 }}>Your response is reviewed by an admin before being shared.</p>
              </>
            ) : (
              <div style={{ marginTop: 4, padding: "13px 16px", background: "var(--green-soft)", borderRadius: 11, fontSize: 13, color: "var(--green)", fontWeight: 700, textAlign: "center" }}>
                ✓ You submitted this feedback
              </div>
            )}
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="fade-in" style={{ padding: "30px 30px 60px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 13, padding: 5, width: "max-content", marginBottom: 20 }}>
        <button
          onClick={() => setTab("allotted")}
          style={{
            padding: "9px 18px",
            borderRadius: 9,
            border: "none",
            background: tab === "allotted" ? "var(--ink)" : "transparent",
            color: tab === "allotted" ? "#fff" : "var(--ink2)",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Allotted
        </button>
        <button
          onClick={() => setTab("submitted")}
          style={{
            padding: "9px 18px",
            borderRadius: 9,
            border: "none",
            background: tab === "submitted" ? "var(--ink)" : "transparent",
            color: tab === "submitted" ? "#fff" : "var(--ink2)",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Submitted
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : tab === "allotted" ? (
        <div>
          {allotted.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                background: "var(--orange-soft)",
                borderRadius: "var(--rm)",
                marginBottom: 18,
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--ink2)",
              }}
            >
              You have <b style={{ color: "var(--orange)" }}>{allotted.length} pending</b> feedback forms assigned to you.
            </div>
          )}
          <div style={{ display: "grid", gap: 12 }}>
            {allotted.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}>
                No pending feedback — you&apos;re all caught up.
              </div>
            ) : (
              allotted.map((f) => {
                const m = TARGET_META[f.targetType];
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", flexWrap: "wrap" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: m.soft, color: m.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontWeight: 700, fontSize: 11 }}>
                      {m.label.slice(0, 3)}
                    </div>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{f.title}</div>
                      <div style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 2 }}>{targetName(f)}</div>
                    </div>
                    <button
                      onClick={() => openFbForm(f.id)}
                      style={{ padding: "10px 18px", background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", flex: "none", whiteSpace: "nowrap" }}
                    >
                      Fill form
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {submitted.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}>
              You haven&apos;t submitted any feedback yet.
            </div>
          ) : (
            submitted.map((f) => {
              const m = TARGET_META[f.targetType];
              return (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", flexWrap: "wrap" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: m.soft, color: m.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontWeight: 700, fontSize: 11 }}>
                    {m.label.slice(0, 3)}
                  </div>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{f.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 2 }}>{targetName(f)}</div>
                  </div>
                  <button
                    onClick={() => openFbForm(f.id)}
                    style={{ padding: "10px 18px", background: "var(--card)", color: "var(--ink2)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", flex: "none", whiteSpace: "nowrap" }}
                  >
                    View
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </main>
  );
}
