"use client";

import { useEffect, useState } from "react";
import { coursesApi, type Batch, type Course, type NoteScope, type NotesBank, type NotesBankScopeInput } from "@/lib/api";

/**
 * Scope picker for a notes bank — the faculty/admin half of Faculty Notes v2.
 *
 * A bank targets exactly one audience: everyone (GENERAL), a course, a set of batches, or one
 * lesson. Which selector is shown follows the chosen scope, and switching scope discards the
 * previous target rather than carrying it along — that mirrors the server's `resolveScope`,
 * which strips the fields the new scope doesn't use. Keeping them in sync matters: a stale
 * courseId left on the payload is the difference between "my batch" and "the whole course".
 */

export const SCOPES: { value: NoteScope; label: string; hint: string }[] = [
  { value: "GENERAL", label: "General", hint: "Every student on the platform" },
  { value: "COURSE", label: "Course", hint: "Everyone enrolled in one course" },
  { value: "BATCH", label: "Batch", hint: "One or more live-class cohorts" },
  { value: "LESSON", label: "Lesson", hint: "Shown against a single lesson" },
];

/** Colour per scope, so "where does this apply" is readable at a glance. */
const SCOPE_CHIP: Record<NoteScope, { bg: string; fg: string }> = {
  GENERAL: { bg: "var(--bg-sunk)", fg: "var(--ink2)" },
  COURSE: { bg: "var(--purple-soft)", fg: "var(--purple-ink)" },
  BATCH: { bg: "var(--orange-soft)", fg: "var(--orange-ink)" },
  LESSON: { bg: "var(--blue-soft)", fg: "var(--blue)" },
};

export function ScopeChip({ scope }: { scope: NoteScope }) {
  const c = SCOPE_CHIP[scope] ?? SCOPE_CHIP.GENERAL;
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
        background: c.bg, color: c.fg, borderRadius: 5, padding: "3px 8px", flex: "none",
      }}
    >
      {scope}
    </span>
  );
}

interface LessonOption {
  id: string;
  title: string;
  chapter: string;
}

export interface ScopeState {
  scope: NoteScope;
  courseId: string;
  lessonId: string;
  batchIds: Set<string>;
  /** yyyy-mm-dd, or "" for none. */
  sessionDate: string;
}

export const emptyScope = (): ScopeState => ({
  // BATCH is what every pre-v2 bank meant, and still the common case.
  scope: "BATCH",
  courseId: "",
  lessonId: "",
  batchIds: new Set(),
  sessionDate: "",
});

export function scopeFromBank(bank: NotesBank): ScopeState {
  return {
    scope: bank.scope,
    courseId: bank.courseId ?? "",
    lessonId: bank.lessonId ?? "",
    batchIds: new Set(bank.batches.map((b) => b.batch.id)),
    sessionDate: bank.sessionDate ? bank.sessionDate.slice(0, 10) : "",
  };
}

/** Mirrors the server's validation so the user sees the problem before the round trip. */
export function validateScope(s: ScopeState): string | null {
  if (s.scope === "COURSE" && !s.courseId) return "Pick a course for course-scoped notes";
  if (s.scope === "LESSON" && !s.lessonId) return "Pick a lesson for lesson-scoped notes";
  if (s.scope === "BATCH" && s.batchIds.size === 0) return "Pick at least one batch";
  return null;
}

export function toScopeInput(s: ScopeState): NotesBankScopeInput {
  return {
    scope: s.scope,
    // Send null rather than omitting, so switching an existing bank to a narrower scope
    // actually clears the old target instead of leaving it untouched.
    courseId: s.scope === "COURSE" || s.scope === "LESSON" ? s.courseId : null,
    lessonId: s.scope === "LESSON" ? s.lessonId : null,
    batchIds: s.scope === "BATCH" ? [...s.batchIds] : [],
    sessionDate: s.sessionDate ? new Date(s.sessionDate).toISOString() : null,
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  border: "1px solid var(--line)",
  borderRadius: "var(--rs)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "var(--ink2)",
  display: "block",
  marginBottom: 6,
};

export default function NotesScopeFields({
  value,
  onChange,
  batches,
}: {
  value: ScopeState;
  onChange: (next: ScopeState) => void;
  batches: Batch[];
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  // Cached against the course it was fetched for, so "which lessons" and "are we still
  // loading" are both derived rather than separate state written from inside an effect.
  const [lessonCache, setLessonCache] = useState<{ courseId: string; lessons: LessonOption[] } | null>(null);

  const needsCourse = value.scope === "COURSE" || value.scope === "LESSON";
  const lessons = lessonCache?.courseId === value.courseId ? lessonCache.lessons : [];
  const loadingLessons = value.scope === "LESSON" && !!value.courseId && lessonCache?.courseId !== value.courseId;

  useEffect(() => {
    if (!needsCourse || courses.length > 0) return;
    // A failed course list shouldn't block the rest of the form — the empty-state copy below
    // covers it and the user can still pick another scope.
    coursesApi.list().then(setCourses).catch(() => setCourses([]));
  }, [needsCourse, courses.length]);

  // Lessons are nested inside the course tree, so they only load once a course is chosen.
  useEffect(() => {
    const courseId = value.courseId;
    if (value.scope !== "LESSON" || !courseId || lessonCache?.courseId === courseId) return;
    let cancelled = false;
    coursesApi
      .get(courseId)
      .then((tree) => {
        if (cancelled) return;
        setLessonCache({
          courseId,
          lessons: tree.chapters.flatMap((c) => c.lessons.map((l) => ({ id: l.id, title: l.title, chapter: c.title }))),
        });
      })
      // Cache the empty result too, so a failed course doesn't spin forever.
      .catch(() => !cancelled && setLessonCache({ courseId, lessons: [] }));
    return () => {
      cancelled = true;
    };
  }, [value.scope, value.courseId, lessonCache]);

  const set = (patch: Partial<ScopeState>) => onChange({ ...value, ...patch });

  function pickScope(scope: NoteScope) {
    // Discard the old target: carrying a courseId into BATCH scope, or batches into GENERAL,
    // is exactly the stale-targeting bug the server guards against.
    set({ scope, courseId: "", lessonId: "", batchIds: new Set() });
  }

  function toggleBatch(id: string) {
    const next = new Set(value.batchIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ batchIds: next });
  }

  const active = SCOPES.find((s) => s.value === value.scope);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <label style={labelStyle}>Who sees these notes</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {SCOPES.map((s) => {
            const on = s.value === value.scope;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => pickScope(s.value)}
                style={{
                  padding: "9px 6px",
                  borderRadius: "var(--rs)",
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  border: `1px solid ${on ? "var(--orange)" : "var(--line)"}`,
                  background: on ? "var(--orange-soft)" : "var(--card)",
                  color: on ? "var(--orange-ink)" : "var(--ink2)",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {active && <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>{active.hint}</div>}
      </div>

      {needsCourse && (
        <div>
          <label style={labelStyle}>Course</label>
          <select
            value={value.courseId}
            onChange={(e) => set({ courseId: e.target.value, lessonId: "" })}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          {courses.length === 0 && <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>No courses available.</div>}
        </div>
      )}

      {value.scope === "LESSON" && (
        <div>
          <label style={labelStyle}>Lesson</label>
          <select
            value={value.lessonId}
            onChange={(e) => set({ lessonId: e.target.value })}
            disabled={!value.courseId || loadingLessons}
            style={{ ...inputStyle, cursor: value.courseId ? "pointer" : "default", opacity: value.courseId ? 1 : 0.6 }}
          >
            <option value="">
              {!value.courseId ? "Pick a course first…" : loadingLessons ? "Loading lessons…" : "Select a lesson…"}
            </option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.chapter} · {l.title}</option>
            ))}
          </select>
          {value.courseId && !loadingLessons && lessons.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>This course has no lessons yet.</div>
          )}
        </div>
      )}

      {value.scope === "BATCH" && (
        <div>
          <label style={labelStyle}>Share with batches</label>
          <div style={{ display: "grid", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {batches.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ink3)" }}>No batches exist yet.</div>
            ) : (
              batches.map((b) => (
                <label
                  key={b.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "var(--rs)", cursor: "pointer", fontSize: 13.5 }}
                >
                  <input
                    type="checkbox"
                    checked={value.batchIds.has(b.id)}
                    onChange={() => toggleBatch(b.id)}
                    style={{ width: 16, height: 16, accentColor: "var(--orange)" }}
                  />
                  {b.name}
                </label>
              ))
            )}
          </div>
          {/* Several batches on one bank is deliberate — it's how a faculty member shares one
              good explanation across every batch of a course. */}
          {value.batchIds.size > 1 && (
            <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>Shared with {value.batchIds.size} batches.</div>
          )}
        </div>
      )}

      <div>
        <label style={labelStyle}>Class date <span style={{ fontWeight: 600, color: "var(--ink3)" }}>· optional</span></label>
        <input
          type="date"
          value={value.sessionDate}
          onChange={(e) => set({ sessionDate: e.target.value })}
          style={{ ...inputStyle, cursor: "pointer" }}
        />
        <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>
          The session these notes cover. Leave blank for prepared or supplementary material.
        </div>
      </div>
    </div>
  );
}
