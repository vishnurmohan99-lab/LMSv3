"use client";

import { useEffect, useMemo, useState } from "react";
import {
  enrollmentsApi,
  coursesApi,
  todosApi,
  reflectionsApi,
  ApiError,
  type Enrollment,
  type CourseTree,
  type Todo,
  type Reflection,
} from "@/lib/api";

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function ProgressBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ color: pct === 100 ? "var(--green)" : pct > 0 ? "var(--orange)" : "var(--ink3)" }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: "var(--bg)", borderRadius: 5 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--orange)", borderRadius: 5, transition: "width .4s ease" }} />
      </div>
    </div>
  );
}

function WeeklyTab() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courseId, setCourseId] = useState("");
  const [course, setCourse] = useState<CourseTree | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    enrollmentsApi
      .mine()
      .then((e) => {
        setEnrollments(e);
        if (e.length > 0) setCourseId(e[0].courseId);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!courseId) return;
    coursesApi.get(courseId).then(setCourse).catch(() => setCourse(null));
  }, [courseId]);

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading…</p>;
  if (enrollments.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}>
        Enroll in a course to see your weekly progress here.
      </div>
    );
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Plan vs actual</div>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, fontFamily: "inherit", background: "var(--bg)" }}
        >
          {enrollments.map((e) => (
            <option key={e.courseId} value={e.courseId}>
              {e.course.title}
            </option>
          ))}
        </select>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink3)", margin: "4px 0 18px" }}>
        Lessons viewed per chapter, based on your real activity in this course.
      </p>
      {!course ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : course.chapters.length === 0 ? (
        <p style={{ color: "var(--ink3)", fontSize: 13 }}>This course has no chapters yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {course.chapters.map((chapter) => {
            const total = chapter.lessons.length;
            const viewed = chapter.lessons.filter((l) => l.viewed).length;
            const pct = total > 0 ? Math.round((viewed / total) * 100) : 0;
            return <ProgressBar key={chapter.id} label={chapter.title} pct={pct} />;
          })}
        </div>
      )}
    </div>
  );
}

function ReflectionTab() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [wentWell, setWentWell] = useState("");
  const [toImprove, setToImprove] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayKey = dayKey(todayMidnight().toISOString());

  function load() {
    setLoading(true);
    reflectionsApi
      .listMine(30)
      .then((rs) => {
        setReflections(rs);
        const today = rs.find((r) => dayKey(r.date) === todayKey);
        setWentWell(today?.wentWell ?? "");
        setToImprove(today?.toImprove ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load reflections"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      await reflectionsApi.upsertMine({ date: todayMidnight().toISOString(), wentWell: wentWell.trim() || undefined, toImprove: toImprove.trim() || undefined });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save reflection");
    } finally {
      setSaving(false);
    }
  }

  const past = reflections.filter((r) => dayKey(r.date) !== todayKey);

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading…</p>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Today&apos;s reflection</div>
        <p style={{ fontSize: 12.5, color: "var(--ink3)", marginBottom: 16 }}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </p>
        <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--green)" }}>What went well 🌱</label>
        <textarea
          value={wentWell}
          onChange={(e) => setWentWell(e.target.value)}
          placeholder="What went well today?"
          style={{ width: "100%", margin: "8px 0 16px", minHeight: 70, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 11, fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.6, outline: "none", resize: "vertical", background: "var(--bg)" }}
        />
        <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--orange)" }}>To improve 🎯</label>
        <textarea
          value={toImprove}
          onChange={(e) => setToImprove(e.target.value)}
          placeholder="What could you improve?"
          style={{ width: "100%", margin: "8px 0 18px", minHeight: 70, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 11, fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.6, outline: "none", resize: "vertical", background: "var(--bg)" }}
        />
        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button
          onClick={onSave}
          disabled={saving || (!wentWell.trim() && !toImprove.trim())}
          style={{ padding: "12px 22px", background: "var(--ink)", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: saving || (!wentWell.trim() && !toImprove.trim()) ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save reflection"}
        </button>
      </div>

      {past.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Past entries</div>
          <div style={{ display: "grid", gap: 12 }}>
            {past.map((r) => (
              <div key={r.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", marginBottom: 6 }}>
                  {new Date(r.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </div>
                {r.wentWell && (
                  <p style={{ fontSize: 13, color: "var(--ink2)", margin: "0 0 4px" }}>
                    <span style={{ color: "var(--green)", fontWeight: 700 }}>🌱 </span>
                    {r.wentWell}
                  </p>
                )}
                {r.toImprove && (
                  <p style={{ fontSize: 13, color: "var(--ink2)", margin: 0 }}>
                    <span style={{ color: "var(--orange)", fontWeight: 700 }}>🎯 </span>
                    {r.toImprove}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TasksTab() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  function load() {
    setLoading(true);
    todosApi.list().then(setTodos).finally(() => setLoading(false));
  }

  useEffect(load, []);

  const todayKey = dayKey(todayMidnight().toISOString());
  const todayTasks = useMemo(() => todos.filter((t) => dayKey(t.date) === todayKey), [todos, todayKey]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    try {
      await todosApi.create({ date: todayMidnight().toISOString(), text: text.trim() });
      setText("");
      load();
    } finally {
      setAdding(false);
    }
  }

  async function onToggle(todo: Todo) {
    await todosApi.update(todo.id, { completed: !todo.completed });
    load();
  }

  async function onDelete(id: string) {
    await todosApi.remove(id);
    load();
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Today&apos;s plan</div>
      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : todayTasks.length === 0 ? (
        <p style={{ color: "var(--ink3)", fontSize: 13.5, marginBottom: 16 }}>No tasks for today yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
          {todayTasks.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg)", borderRadius: 13 }}>
              <button
                onClick={() => onToggle(t)}
                aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  flex: "none",
                  border: t.completed ? "none" : "2px solid var(--line)",
                  background: t.completed ? "var(--green)" : "var(--card)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                {t.completed && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.completed ? "var(--ink3)" : "var(--ink)", textDecoration: t.completed ? "line-through" : "none" }}>
                {t.text}
              </span>
              <button
                onClick={() => onDelete(t.id)}
                title="Delete"
                style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--red)", flex: "none" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={onAdd} style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task for today…"
          style={{ flex: 1, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 11, fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "var(--bg)" }}
        />
        <button
          type="submit"
          disabled={adding || !text.trim()}
          style={{ padding: "12px 20px", background: "var(--orange)", color: "#fff", border: "none", borderRadius: 11, fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: adding || !text.trim() ? 0.6 : 1 }}
        >
          + Add task
        </button>
      </form>
    </div>
  );
}

export default function StudentPlannerPage() {
  const [tab, setTab] = useState<"weekly" | "reflection" | "tasks">("weekly");

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "weekly", label: "Weekly" },
    { key: "reflection", label: "Reflection" },
    { key: "tasks", label: "Tasks" },
  ];

  return (
    <main className="fade-in mobile-page-pad" style={{ padding: "30px 30px 60px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 22 }}>Study Planner</div>

      <div style={{ display: "flex", gap: 6, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 13, padding: 5, width: "max-content", marginBottom: 20 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "9px 18px",
              borderRadius: 9,
              border: "none",
              background: tab === t.key ? "var(--ink)" : "transparent",
              color: tab === t.key ? "#fff" : "var(--ink2)",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "weekly" && <WeeklyTab />}
      {tab === "reflection" && <ReflectionTab />}
      {tab === "tasks" && <TasksTab />}
    </main>
  );
}
