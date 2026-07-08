"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  todosApi,
  reflectionsApi,
  planApi,
  ApiError,
  type Todo,
  type Reflection,
  type StudyPlanItem,
  type PlanItemType,
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

const PLAN_TYPE_META: Record<PlanItemType, { label: string; ink: string; bg: string }> = {
  VIDEO: { label: "Video", ink: "var(--orange-deep)", bg: "var(--orange-soft)" },
  NOTES: { label: "Notes", ink: "var(--purple-ink)", bg: "var(--purple-soft)" },
  TEST: { label: "Test", ink: "var(--blue)", bg: "var(--blue-soft)" },
  PRACTICE: { label: "Practice", ink: "var(--green)", bg: "var(--green-soft)" },
  OTHER: { label: "Task", ink: "var(--ink2)", bg: "var(--bg-sunk)" },
};

function planHref(it: StudyPlanItem): string | null {
  switch (it.resourceKind) {
    case "course":
      return it.courseId ? `/student/courses/${it.courseId}` : null;
    case "test":
      return it.resourceId ? `/student/mock-test/${it.resourceId}` : null;
    case "note":
      return "/student/notes";
    case "workout":
      return `/student/workout${it.courseId ? `?course=${it.courseId}` : ""}`;
    default:
      return it.courseId ? `/student/courses/${it.courseId}` : null;
  }
}

function localKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function TimetableTab() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [items, setItems] = useState<StudyPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState<PlanItemType>("PRACTICE");
  const [adding, setAdding] = useState(false);

  const weekEnd = useMemo(() => {
    const e = new Date(weekStart);
    e.setDate(e.getDate() + 7);
    return e;
  }, [weekStart]);

  function load() {
    setLoading(true);
    planApi
      .mine({ from: weekStart.toISOString(), to: weekEnd.toISOString() })
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load plan"))
      .finally(() => setLoading(false));
  }
  useEffect(load, [weekStart, weekEnd]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const itemsByDay = useMemo(() => {
    const m = new Map<string, StudyPlanItem[]>();
    for (const it of items) {
      const k = localKey(new Date(it.scheduledFor));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    return m;
  }, [items]);

  async function onAddPersonal() {
    if (!title.trim() || !date) {
      setError("Give your plan item a title and a date.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const scheduledFor = new Date(`${date}T${time || "09:00"}`).toISOString();
      await planApi.createMine({ scheduledFor, type, title: title.trim() });
      setTitle("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to add item");
    } finally {
      setAdding(false);
    }
  }

  async function onDelete(it: StudyPlanItem) {
    try {
      await planApi.removeItem(it.id);
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to remove");
    }
  }

  const todayKey = localKey(new Date());

  return (
    <div>
      {/* Week nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() - 7); return n; })} style={navBtn}>‹ Prev</button>
        <div style={{ fontSize: 14, fontWeight: 800 }}>
          {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </div>
        <button onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() + 7); return n; })} style={navBtn}>Next ›</button>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {/* Day-by-day timetable */}
      {loading ? (
        <p style={{ color: "var(--ink3)", fontSize: 13 }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {days.map((d) => {
            const key = localKey(d);
            const dayItems = itemsByDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div key={key} style={{ background: "var(--card)", border: isToday ? "1.5px solid var(--orange)" : "1px solid var(--line)", borderRadius: "var(--rl)", padding: "14px 16px" }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: isToday ? "var(--orange-deep)" : "var(--ink2)", marginBottom: dayItems.length ? 10 : 0 }}>
                  {d.toLocaleDateString(undefined, { weekday: "long" })} · {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {isToday && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "var(--orange-deep)", background: "var(--orange-soft)", padding: "2px 8px", borderRadius: 999 }}>Today</span>}
                </div>
                {dayItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--ink3)" }}>Nothing planned.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {dayItems.map((it) => {
                      const meta = PLAN_TYPE_META[it.type];
                      const href = planHref(it);
                      const inner = (
                        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: "var(--rs)", background: "var(--bg-sunk)" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink3)", width: 42, flex: "none" }}>
                            {new Date(it.scheduledFor).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: meta.ink, background: meta.bg, borderRadius: 999, padding: "3px 9px", flex: "none" }}>{meta.label}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "inherit" }}>{it.title}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: it.source === "personal" ? "var(--ink3)" : "var(--purple-ink)", background: it.source === "personal" ? "transparent" : "var(--purple-soft)", padding: it.source === "personal" ? 0 : "2px 8px", borderRadius: 999, flex: "none" }}>
                            {it.source === "personal" ? "You" : it.batch?.name ?? "Batch"}
                          </span>
                          {it.source === "personal" && (
                            <button onClick={(e) => { e.preventDefault(); onDelete(it); }} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flex: "none" }}>✕</button>
                          )}
                        </div>
                      );
                      return href ? (
                        <Link key={it.id} href={href} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link>
                      ) : (
                        <div key={it.id}>{inner}</div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add your own */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 16, marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>Add your own plan</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, alignItems: "end" }}>
          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Practice DI set / Mock test 3" style={fieldStyle} />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value as PlanItemType)} style={{ ...fieldStyle, cursor: "pointer" }}>
            <option value="PRACTICE">Practice</option>
            <option value="TEST">Mock test</option>
            <option value="VIDEO">Revision</option>
            <option value="OTHER">Task</option>
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={fieldStyle} />
          <button onClick={onAddPersonal} disabled={adding} style={{ padding: "10px 14px", background: "var(--ink)", color: "#fff", border: "none", borderRadius: "var(--rs)", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: adding ? "default" : "pointer", opacity: adding ? 0.7 : 1, height: 38 }}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = { padding: "7px 14px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rs)", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", color: "var(--ink2)" };
const fieldStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "var(--rs)", fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "var(--card)" };

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
  const [tab, setTab] = useState<"timetable" | "reflection" | "tasks">("timetable");

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "timetable", label: "Timetable" },
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

      {tab === "timetable" && <TimetableTab />}
      {tab === "reflection" && <ReflectionTab />}
      {tab === "tasks" && <TasksTab />}
    </main>
  );
}
