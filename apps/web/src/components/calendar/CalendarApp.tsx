"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { calendarApi, todosApi, ApiError, type CalendarEvent, type Todo } from "@/lib/api";

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
  cursor: "pointer",
};

function LiveIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2">
      <path d="m23 7-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}

function MentorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </svg>
  );
}

function TestIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function eventColor(type: CalendarEvent["type"]) {
  if (type === "LIVE_LESSON") return "var(--orange)";
  if (type === "CHAPTER_UNLOCK") return "var(--green)";
  if (type === "TEST") return "var(--orange)";
  return "var(--purple)";
}

function eventBg(type: CalendarEvent["type"]) {
  if (type === "LIVE_LESSON") return "var(--orange-soft)";
  if (type === "CHAPTER_UNLOCK") return "var(--green-soft)";
  if (type === "TEST") return "var(--orange-soft)";
  return "var(--purple-soft)";
}

function eventLabel(type: CalendarEvent["type"]) {
  if (type === "LIVE_LESSON") return "Live class";
  if (type === "CHAPTER_UNLOCK") return "Course unlock";
  if (type === "TEST") return "Test";
  return "Mentor session";
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function EventRow({ event, role }: { event: CalendarEvent; role: "student" | "faculty" }) {
  const time = new Date(event.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const content = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: eventBg(event.type),
        borderRadius: 10,
        fontSize: 12.5,
      }}
    >
      <span style={{ display: "flex" }}>
        {event.type === "LIVE_LESSON" ? (
          <LiveIcon />
        ) : event.type === "CHAPTER_UNLOCK" ? (
          <UnlockIcon />
        ) : event.type === "TEST" ? (
          <TestIcon />
        ) : (
          <MentorIcon />
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {event.title}
        </div>
        <div style={{ color: "var(--ink3)", fontSize: 11, marginTop: 1 }}>
          {time}
          {event.courseTitle ? ` · ${event.courseTitle}` : ""}
        </div>
      </div>
      <span style={{ fontWeight: 700, fontSize: 10.5, color: eventColor(event.type), whiteSpace: "nowrap" }}>
        {eventLabel(event.type)}
      </span>
    </div>
  );

  if (event.type === "TEST" && event.testId) {
    const href = role === "student" ? `/student/mock-test/${event.testId}` : `/faculty/tests/${event.testId}`;
    return <Link href={href} style={{ textDecoration: "none", display: "block" }}>{content}</Link>;
  }
  if ((event.type === "LIVE_LESSON" || event.type === "CHAPTER_UNLOCK") && event.courseId) {
    const href = role === "student" ? `/student/courses/${event.courseId}` : `/faculty/courses/${event.courseId}`;
    return <Link href={href} style={{ textDecoration: "none", display: "block" }}>{content}</Link>;
  }
  return content;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function TodoPanel({ selectedDate }: { selectedDate: Date }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);

  function load() {
    setLoading(true);
    todosApi
      .list()
      .then(setTodos)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const dayTodos = todos.filter((t) => dayKey(new Date(t.date)) === dayKey(selectedDate));

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    try {
      const isoMidnight = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).toISOString();
      await todosApi.create({ date: isoMidnight, text: text.trim() });
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
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>To-do</div>
      <form onSubmit={onAdd} style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task for this day…"
          style={{ ...inputStyle, flex: 1, cursor: "text" }}
        />
        <button
          type="submit"
          disabled={adding || !text.trim()}
          style={{
            padding: "8px 14px",
            background: "var(--orange)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
            opacity: adding || !text.trim() ? 0.6 : 1,
          }}
        >
          Add
        </button>
      </form>
      {loading ? (
        <p style={{ color: "var(--ink3)", fontSize: 12.5 }}>Loading…</p>
      ) : dayTodos.length === 0 ? (
        <p style={{ color: "var(--ink3)", fontSize: 12.5 }}>No to-dos for this day yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {dayTodos.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--bg)", borderRadius: 9 }}>
              <input type="checkbox" checked={t.completed} onChange={() => onToggle(t)} style={{ flex: "none" }} />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: t.completed ? "var(--ink3)" : "var(--ink)",
                  textDecoration: t.completed ? "line-through" : "none",
                }}
              >
                {t.text}
              </span>
              <button
                onClick={() => onDelete(t.id)}
                title="Delete"
                style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--red)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CalendarApp({ role }: { role: "student" | "faculty" }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  useEffect(() => {
    const fetcher = role === "student" ? calendarApi.student : calendarApi.faculty;
    fetcher()
      .then(setEvents)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load calendar"))
      .finally(() => setLoading(false));
  }, [role]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [events]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return events.filter((e) => new Date(e.date).getTime() >= now).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [events]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const gridDays = useMemo(() => {
    const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = firstDay.getDay();
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor]);

  function changeMonth(delta: number) {
    setCursor((c) => {
      const next = new Date(c);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  }

  const selectedKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
  const selectedEvents = (eventsByDay.get(selectedKey) ?? []).sort((a, b) => a.date.localeCompare(b.date));
  const today = new Date();

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--red)" }}>{error}</p>;

  return (
    <div className="fade-in-up" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 22, alignItems: "start" }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{monthLabel}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => changeMonth(-1)} style={inputStyle}>‹ Prev</button>
            <button onClick={() => { setCursor(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }); setSelectedDate(new Date()); }} style={inputStyle}>
              Today
            </button>
            <button onClick={() => changeMonth(1)} style={inputStyle}>Next ›</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--ink3)", padding: "4px 0" }}>
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {gridDays.map((d) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = sameDay(d, today);
            const isSelected = sameDay(d, selectedDate);
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(d)}
                style={{
                  minHeight: 64,
                  padding: "6px 6px",
                  border: isSelected ? "1.5px solid var(--orange)" : "1px solid var(--line)",
                  borderRadius: 10,
                  background: isSelected ? "var(--orange-soft)" : "var(--bg)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  opacity: inMonth ? 1 : 0.4,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: isToday ? 800 : 600,
                    color: isToday ? "var(--orange)" : "var(--ink2)",
                  }}
                >
                  {d.getDate()}
                </span>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {dayEvents.slice(0, 3).map((e) => (
                    <span key={e.id} style={{ width: 6, height: 6, borderRadius: "50%", background: eventColor(e.type) }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
            {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </div>
          {selectedEvents.length === 0 ? (
            <p style={{ color: "var(--ink3)", fontSize: 12.5 }}>Nothing scheduled this day.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {selectedEvents.map((e) => (
                <EventRow key={e.id} event={e} role={role} />
              ))}
            </div>
          )}
        </div>

        <TodoPanel selectedDate={selectedDate} />

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Upcoming</div>
          {upcoming.length === 0 ? (
            <p style={{ color: "var(--ink3)", fontSize: 12.5 }}>Nothing upcoming.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {upcoming.map((e) => (
                <EventRow key={e.id} event={e} role={role} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
