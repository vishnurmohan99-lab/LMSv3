"use client";

import { useEffect, useMemo, useState } from "react";
import {
  feedbackApi,
  coursesApi,
  usersApi,
  mentorApi,
  batchesApi,
  ApiError,
  type FeedbackForm,
  type FeedbackFormWithResponses,
  type FeedbackQuestion,
  type FeedbackTargetType,
  type FeedbackAssignType,
  type Course,
  type Profile,
  type Mentor,
  type Batch,
} from "@/lib/api";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid var(--line)",
  borderRadius: 11,
  fontSize: 13.5,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
  color: "var(--ink)",
};

const TARGET_TABS: { value: FeedbackTargetType; label: string }[] = [
  { value: "COURSE", label: "Full Course" },
  { value: "FACULTY", label: "Faculty" },
  { value: "MENTOR", label: "Mentor" },
  { value: "SYSTEM", label: "Whole System" },
];

const TARGET_META: Record<FeedbackTargetType, { label: string; color: string; soft: string }> = {
  COURSE: { label: "Course", color: "var(--orange)", soft: "var(--orange-soft)" },
  FACULTY: { label: "Faculty", color: "#3b6fd6", soft: "#e8eefb" },
  MENTOR: { label: "Mentor", color: "var(--purple)", soft: "var(--purple-soft)" },
  SYSTEM: { label: "System", color: "var(--green)", soft: "var(--green-soft)" },
};

const DEFAULT_QUESTIONS: Record<FeedbackTargetType, FeedbackQuestion[]> = {
  COURSE: [
    { type: "RATING", label: "Overall course rating" },
    { type: "RATING", label: "Content clarity" },
    { type: "TEXT", label: "What could be improved?" },
  ],
  FACULTY: [
    { type: "RATING", label: "Teaching effectiveness" },
    { type: "RATING", label: "Doubt resolution" },
    { type: "TEXT", label: "Additional comments" },
  ],
  MENTOR: [
    { type: "RATING", label: "How helpful was the session?" },
    { type: "TEXT", label: "Additional comments" },
  ],
  SYSTEM: [
    { type: "RATING", label: "Overall app experience" },
    { type: "TEXT", label: "Suggestions for improvement" },
  ],
};

function targetName(f: FeedbackForm) {
  if (f.targetType === "COURSE") return f.targetCourse?.title ?? "—";
  if (f.targetType === "SYSTEM") return f.targetSystemArea ?? "—";
  return f.targetFaculty?.fullName ?? "—";
}

function assignedToLabel(f: FeedbackForm) {
  return f.assignType === "BATCH" ? f.batch?.name ?? "Batch" : "Selected students";
}

function Stars({ value, size = 16 }: { value: number | null | undefined; size?: number }) {
  const v = Math.round(value ?? 0);
  return (
    <span style={{ color: "var(--orange)", fontSize: size }}>
      {"★".repeat(v)}
      <span style={{ color: "var(--line)" }}>{"★".repeat(Math.max(0, 5 - v))}</span>
    </span>
  );
}

export default function AdminFeedbackPage() {
  const [view, setView] = useState<"forms" | "create" | "responses">("forms");
  const [forms, setForms] = useState<FeedbackForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [faculty, setFaculty] = useState<Profile[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [title, setTitle] = useState("");
  const [targetType, setTargetType] = useState<FeedbackTargetType>("COURSE");
  const [targetCourseId, setTargetCourseId] = useState("");
  const [targetFacultyId, setTargetFacultyId] = useState("");
  const [targetSystemArea, setTargetSystemArea] = useState("");
  const [questions, setQuestions] = useState<FeedbackQuestion[]>(DEFAULT_QUESTIONS.COURSE);
  const [assignType, setAssignType] = useState<FeedbackAssignType>("BATCH");
  const [batchId, setBatchId] = useState("");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedForm, setSelectedForm] = useState<FeedbackFormWithResponses | null>(null);
  const [responsesLoading, setResponsesLoading] = useState(false);

  function loadForms() {
    setLoading(true);
    feedbackApi
      .list()
      .then(setForms)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load feedback forms"))
      .finally(() => setLoading(false));
  }

  useEffect(loadForms, []);

  useEffect(() => {
    coursesApi.list().then(setCourses).catch(() => {});
    usersApi.list().then((all) => {
      setFaculty(all.filter((u) => u.role === "FACULTY"));
      setStudents(all.filter((u) => u.role === "STUDENT"));
    }).catch(() => {});
    mentorApi.listMentors().then(setMentors).catch(() => {});
    batchesApi.listAll().then(setBatches).catch(() => {});
  }, []);

  function resetCreateForm() {
    setTitle("");
    setTargetType("COURSE");
    setTargetCourseId("");
    setTargetFacultyId("");
    setTargetSystemArea("");
    setQuestions(DEFAULT_QUESTIONS.COURSE);
    setAssignType("BATCH");
    setBatchId("");
    setStudentIds([]);
  }

  function startCreate() {
    resetCreateForm();
    setView("create");
  }

  function onTargetTypeChange(t: FeedbackTargetType) {
    setTargetType(t);
    setTargetCourseId("");
    setTargetFacultyId("");
    setTargetSystemArea("");
    setQuestions(DEFAULT_QUESTIONS[t]);
  }

  function setQuestionType(i: number, type: "RATING" | "TEXT") {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, type } : q)));
  }
  function setQuestionLabel(i: number, label: string) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, label } : q)));
  }
  function addQuestion() {
    setQuestions((qs) => [...qs, { type: "TEXT", label: "" }]);
  }
  function removeQuestion(i: number) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }
  function toggleStudent(id: string) {
    setStudentIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  const targetNameValue = targetType === "COURSE" ? targetCourseId : targetType === "SYSTEM" ? targetSystemArea : targetFacultyId;
  const canCreate =
    title.trim().length > 0 &&
    !!targetNameValue &&
    questions.length > 0 &&
    questions.every((q) => q.label.trim().length > 0) &&
    (assignType === "BATCH" ? !!batchId : studentIds.length > 0);

  async function onCreate() {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      await feedbackApi.create({
        title: title.trim(),
        targetType,
        targetCourseId: targetType === "COURSE" ? targetCourseId : undefined,
        targetFacultyId: targetType === "FACULTY" || targetType === "MENTOR" ? targetFacultyId : undefined,
        targetSystemArea: targetType === "SYSTEM" ? targetSystemArea : undefined,
        questions,
        assignType,
        batchId: assignType === "BATCH" ? batchId : undefined,
        studentIds: assignType === "SELECTED" ? studentIds : undefined,
      });
      setView("forms");
      loadForms();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create feedback form");
    } finally {
      setCreating(false);
    }
  }

  function openResponses(id: string) {
    setSelectedFormId(id);
    setView("responses");
    setResponsesLoading(true);
    feedbackApi
      .getForAdmin(id)
      .then(setSelectedForm)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load responses"))
      .finally(() => setResponsesLoading(false));
  }

  const totalResponses = forms.reduce((sum, f) => sum + f._count.responses, 0);
  const ratingsAcrossForms = forms.filter((f) => f.avgRating != null).map((f) => f.avgRating as number);
  const avgAll = ratingsAcrossForms.length ? (ratingsAcrossForms.reduce((a, b) => a + b, 0) / ratingsAcrossForms.length).toFixed(1) : "—";

  const targetOptions = useMemo(() => {
    if (targetType === "COURSE") return courses.map((c) => ({ value: c.id, label: c.title }));
    if (targetType === "FACULTY") return faculty.map((f) => ({ value: f.id, label: f.fullName }));
    if (targetType === "MENTOR") return mentors.map((m) => ({ value: m.id, label: m.fullName }));
    return [];
  }, [targetType, courses, faculty, mentors]);

  return (
    <div style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      {view === "forms" && (
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Feedback forms</div>
              <p style={{ fontSize: 13, color: "var(--ink3)", margin: "3px 0 0" }}>
                Create, assign and review feedback across courses, faculty, mentors and the platform.
              </p>
            </div>
            <button
              onClick={startCreate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 18px",
                background: "var(--ink)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              + Create form
            </button>
          </div>

          {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
            {[
              ["Active forms", forms.length],
              ["Responses", totalResponses],
              ["Avg rating", avgAll === "—" ? "—" : `${avgAll}★`],
            ].map(([label, value]) => (
              <div key={label} style={{ flex: 1, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "16px 18px" }}>
                <div style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginTop: 4 }}>{value}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <p style={{ color: "var(--ink2)" }}>Loading…</p>
          ) : forms.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}>
              No feedback forms yet — create one to start collecting feedback.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {forms.map((f) => {
                const m = TARGET_META[f.targetType];
                return (
                  <div
                    key={f.id}
                    style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", flexWrap: "wrap" }}
                  >
                    <span style={{ padding: "5px 11px", borderRadius: 8, background: m.soft, color: m.color, fontSize: 11, fontWeight: 700, flex: "none" }}>{m.label}</span>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{f.title}</div>
                      <div style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 2 }}>
                        {targetName(f)} · {assignedToLabel(f)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{f._count.responses}</div>
                      <div style={{ fontSize: 11, color: "var(--ink3)" }}>responses</div>
                    </div>
                    <button
                      onClick={() => openResponses(f.id)}
                      style={{ padding: "10px 16px", background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", flex: "none" }}
                    >
                      View responses
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "create" && (
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <button
            onClick={() => setView("forms")}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", marginBottom: 18 }}
          >
            ← Back
          </button>
          {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: "28px 30px" }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, marginBottom: 22 }}>Create feedback form</div>

            <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>Form title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Course Feedback: Maths"
              style={{ ...inputStyle, margin: "8px 0 20px" }}
            />

            <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>Feedback about</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, margin: "8px 0 20px" }}>
              {TARGET_TABS.map((t) => {
                const active = targetType === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => onTargetTypeChange(t.value)}
                    style={{
                      padding: "11px 8px",
                      borderRadius: 11,
                      border: `1.5px solid ${active ? "var(--orange)" : "var(--line)"}`,
                      background: active ? "var(--orange-soft)" : "var(--card)",
                      color: active ? "var(--orange)" : "var(--ink2)",
                      fontSize: 12.5,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {targetType === "SYSTEM" ? (
              <>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>Area</label>
                <input
                  value={targetSystemArea}
                  onChange={(e) => setTargetSystemArea(e.target.value)}
                  placeholder="e.g. Paperlms App"
                  style={{ ...inputStyle, margin: "8px 0 22px" }}
                />
              </>
            ) : (
              <>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>
                  {targetType === "COURSE" ? "Select course" : targetType === "FACULTY" ? "Select faculty" : "Select mentor"}
                </label>
                <select
                  value={targetType === "COURSE" ? targetCourseId : targetFacultyId}
                  onChange={(e) => (targetType === "COURSE" ? setTargetCourseId(e.target.value) : setTargetFacultyId(e.target.value))}
                  style={{ ...inputStyle, margin: "8px 0 22px" }}
                >
                  <option value="">
                    {targetType === "COURSE" ? "Select course" : targetType === "FACULTY" ? "Select faculty" : "Select mentor"}
                  </option>
                  {targetOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </>
            )}

            <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>Questions</label>
            <div style={{ display: "grid", gap: 10, margin: "8px 0 12px" }}>
              {questions.map((q, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--bg)", borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 4, background: "var(--card)", borderRadius: 9, padding: 3, flex: "none" }}>
                    {(["RATING", "TEXT"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setQuestionType(i, t)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 7,
                          border: "none",
                          background: q.type === t ? "var(--ink)" : "transparent",
                          color: q.type === t ? "#fff" : "var(--ink3)",
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: "inherit",
                          cursor: "pointer",
                        }}
                      >
                        {t === "RATING" ? "★" : "Aa"}
                      </button>
                    ))}
                  </div>
                  <input
                    value={q.label}
                    onChange={(e) => setQuestionLabel(i, e.target.value)}
                    placeholder="Question label"
                    style={{ flex: 1, minWidth: 0, padding: "9px 11px", border: "1px solid var(--line)", borderRadius: 9, fontSize: 13, fontFamily: "inherit", outline: "none", background: "var(--card)" }}
                  />
                  <button
                    onClick={() => removeQuestion(i)}
                    style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink3)", cursor: "pointer", flex: "none", fontSize: 16, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addQuestion}
              style={{ width: "100%", padding: 11, border: "1.5px dashed var(--line)", background: "var(--card)", color: "var(--ink2)", borderRadius: 11, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
            >
              + Add question
            </button>

            <div style={{ height: 24 }} />

            <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>Assign to</label>
            <div style={{ display: "flex", gap: 10, margin: "8px 0 14px" }}>
              <button
                onClick={() => setAssignType("BATCH")}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 11,
                  border: `1.5px solid ${assignType === "BATCH" ? "var(--orange)" : "var(--line)"}`,
                  background: assignType === "BATCH" ? "var(--orange-soft)" : "var(--card)",
                  color: assignType === "BATCH" ? "var(--orange)" : "var(--ink2)",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Whole batch
              </button>
              <button
                onClick={() => setAssignType("SELECTED")}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 11,
                  border: `1.5px solid ${assignType === "SELECTED" ? "var(--orange)" : "var(--line)"}`,
                  background: assignType === "SELECTED" ? "var(--orange-soft)" : "var(--card)",
                  color: assignType === "SELECTED" ? "var(--orange)" : "var(--ink2)",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Selected students
              </button>
            </div>

            {assignType === "BATCH" ? (
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)} style={inputStyle}>
                <option value="">Select batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.segment?.name ?? b.subsegment?.name ?? "Unscoped"}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {students.map((s) => {
                  const on = studentIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: `1px solid ${on ? "var(--orange)" : "var(--line)"}`,
                        background: on ? "var(--orange-soft)" : "var(--card)",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{s.fullName}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={onCreate}
              disabled={!canCreate || creating}
              style={{
                width: "100%",
                marginTop: 24,
                padding: 14,
                background: !canCreate || creating ? "var(--line)" : "var(--ink)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: !canCreate || creating ? "default" : "pointer",
              }}
            >
              {creating ? "Creating…" : "Create & assign"}
            </button>
          </div>
        </div>
      )}

      {view === "responses" && (
        <div>
          <button
            onClick={() => setView("forms")}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", marginBottom: 18 }}
          >
            ← Back
          </button>
          {responsesLoading || !selectedForm ? (
            <p style={{ color: "var(--ink2)" }}>Loading…</p>
          ) : (
            <>
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24, marginBottom: 16 }}>
                <span style={{ padding: "5px 11px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: TARGET_META[selectedForm.targetType].soft, color: TARGET_META[selectedForm.targetType].color }}>
                  {TARGET_META[selectedForm.targetType].label}
                </span>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3, marginTop: 10 }}>{selectedForm.title}</div>
                <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 2 }}>{targetName(selectedForm)}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
                  {[
                    ["Responses", selectedForm.responses.length],
                    ["Avg rating", selectedForm.avgRating != null ? `${selectedForm.avgRating.toFixed(1)}★` : "—"],
                    ["Assigned to", assignedToLabel(selectedForm)],
                  ].map(([label, value]) => (
                    <div key={label} style={{ flex: 1, minWidth: 120, background: "var(--bg)", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 3 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Responses</div>
              {selectedForm.responses.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}>
                  No responses yet.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {selectedForm.responses.map((r) => (
                    <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            background: "linear-gradient(135deg,#f7902b,#f24d1b)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 12,
                            flex: "none",
                          }}
                        >
                          {r.student?.fullName.split(" ").map((x) => x[0]).join("").slice(0, 2)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.student?.fullName}</div>
                          <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{new Date(r.submittedAt).toLocaleDateString()}</div>
                        </div>
                        {r.rating != null && <Stars value={r.rating} />}
                      </div>
                      <div style={{ display: "grid", gap: 7 }}>
                        {selectedForm.questions.map((q, qi) => (
                          <div key={qi} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                            <span style={{ color: "var(--ink3)" }}>{q.label}: </span>
                            {q.type === "RATING" ? (
                              <b style={{ color: "var(--orange)" }}>{r.answers[qi] || 0}★</b>
                            ) : (
                              <span style={{ color: "var(--ink)" }}>&ldquo;{r.answers[qi] || "—"}&rdquo;</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
