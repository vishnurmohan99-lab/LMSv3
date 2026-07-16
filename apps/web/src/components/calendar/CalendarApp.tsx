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

/**
 * Per-type chip palette, taken from the design system's C2 "Calendar cell + event rows"
 * sheet. `tint` is deliberately deeper than the matching --*-soft token (e.g. mentor is
 * #ece6ff, not --purple-soft #f5f2ff) so 10px chip text stays legible — the soft tokens
 * wash out at that size. `bar`/`ink` are on-token.
 */
const EVENT_STYLE: Record<CalendarEvent["type"], { bar: string; tint: string; ink: string; short: string; label: string }> = {
  LIVE_LESSON: { bar: "var(--live)", tint: "var(--live-soft)", ink: "var(--live)", short: "Live", label: "Live class" },
  MENTOR_SESSION: { bar: "var(--purple)", tint: "#ece6ff", ink: "var(--purple-ink)", short: "Mentor", label: "Mentor session" },
  TEST: { bar: "var(--orange)", tint: "#fff6ef", ink: "var(--orange-deep)", short: "Test", label: "Mock test" },
  CHAPTER_UNLOCK: { bar: "var(--progress)", tint: "var(--green-soft)", ink: "var(--green)", short: "Unlock", label: "Content unlock" },
};

function eventColor(type: CalendarEvent["type"]) {
  return EVENT_STYLE[type].bar;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Same live-window heuristic the dashboard uses: a LIVE_LESSON counts as "live now"
// from 10 min before its start until 90 min after.
const LIVE_WINDOW_BEFORE_MIN = 10;
const LIVE_WINDOW_AFTER_MIN = 90;
function isCurrentlyLive(event: CalendarEvent, now: Date) {
  if (event.type !== "LIVE_LESSON") return false;
  const diffMin = (now.getTime() - new Date(event.date).getTime()) / 60000;
  return diffMin >= -LIVE_WINDOW_BEFORE_MIN && diffMin <= LIVE_WINDOW_AFTER_MIN;
}

const squareNavBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  border: "1px solid var(--line)",
  background: "var(--card)",
  borderRadius: 8,
  color: "var(--ink3)",
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const LEGEND: { label: string; color: string }[] = [
  { label: "Live", color: EVENT_STYLE.LIVE_LESSON.bar },
  { label: "Mentor", color: EVENT_STYLE.MENTOR_SESSION.bar },
  { label: "Test", color: EVENT_STYLE.TEST.bar },
  { label: "Unlock", color: EVENT_STYLE.CHAPTER_UNLOCK.bar },
];

/** Dark gradient "LIVE NOW" card matching the calendar mockup's today panel. */
function LiveNowCard({ event, role }: { event: CalendarEvent; role: "student" | "faculty" }) {
  const time = new Date(event.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const href = event.courseId ? (role === "student" ? `/student/courses/${event.courseId}` : `/faculty/courses/${event.courseId}`) : null;
  // Desktop (screen 5) stacks badge+time / title / meta / Join. Mobile (5m) is one row:
  // badge · title+meta · Join — reflowed in CSS rather than duplicating the markup.
  return (
    <div className="cal-live-card">
      <div className="cal-live-top">
        <span className="live-pulse cal-live-badge">● LIVE<span className="cal-live-nowword"> NOW</span></span>
        <span className="cal-live-time">{time}</span>
      </div>
      <div className="cal-live-body">
        <div className="cal-live-title">{event.title}</div>
        <div className="cal-live-meta">
          <span className="cal-live-metatime">{time}{event.courseTitle ? " · " : ""}</span>
          {event.courseTitle ?? ""}
        </div>
      </div>
      {href && (
        <Link href={href} className="cal-live-join">
          Join<span className="cal-live-arrow"> →</span>
        </Link>
      )}
    </div>
  );
}

function EventRow({ event, role }: { event: CalendarEvent; role: "student" | "faculty" }) {
  const time = new Date(event.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const done = new Date(event.date).getTime() < Date.now();
  const meta = [time, done ? "done" : null, event.courseTitle || event.otherPartyName || null].filter(Boolean).join(" · ");
  const content = (
    <div className="cal-event-row">
      <span style={{ width: 3, borderRadius: 2, background: eventColor(event.type), flex: "none", alignSelf: "stretch" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {event.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 1 }}>{meta}</div>
      </div>
      {done && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", flex: "none" }}>✓</span>}
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
    <div className="fade-in-up cal-shell">
      <div className="cal-left">
        <div className="cal-head">
          <span className="cal-month">{monthLabel}</span>
          <button onClick={() => changeMonth(-1)} style={squareNavBtn} aria-label="Previous month">‹</button>
          <button onClick={() => changeMonth(1)} style={squareNavBtn} aria-label="Next month">›</button>
          <button
            onClick={() => { setCursor(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }); setSelectedDate(new Date()); }}
            style={{ ...squareNavBtn, width: "auto", padding: "0 12px", fontSize: 11.5, fontWeight: 600 }}
          >
            Today
          </button>
          <div style={{ flex: 1 }} />
          <div className="cal-legend">
            {LEGEND.map((l) => (
              <span key={l.label} style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 10.5, fontWeight: 500, color: "var(--ink3)" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        <div className="cal-dow-row">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="cal-dow">{d}</div>
          ))}
        </div>

        <div className="cal-grid">
          {gridDays.map((d) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const dayEvents = (eventsByDay.get(key) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
            const isToday = sameDay(d, today);
            const isSelected = sameDay(d, selectedDate);
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(d)}
                className="calendar-day-cell"
                style={{
                  border: isSelected ? "1.5px solid var(--orange)" : "1px solid var(--line)",
                  background: isSelected ? "var(--orange-soft)" : "var(--card)",
                  opacity: inMonth ? 1 : 0.45,
                }}
              >
                {/* Day number sits top-right per the design; today is an orange pill. */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <span
                    className="cal-daynum"
                    style={
                      isToday
                        ? { background: "var(--orange)", color: "#fff", borderRadius: 999, fontFamily: "var(--font-mono)" }
                        : { color: "var(--ink2)" }
                    }
                  >
                    {d.getDate()}
                  </span>
                </div>

                {/* Desktop: labelled chips. Mobile: dots — swapped in CSS at 860px. */}
                <div className="cal-chips">
                  {dayEvents.slice(0, 3).map((e) => {
                    const st = EVENT_STYLE[e.type];
                    const t = new Date(e.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
                    return (
                      <div
                        key={e.id}
                        className={`cal-chip${isCurrentlyLive(e, today) ? " cal-chip-live" : ""}`}
                        style={{ background: st.tint, color: st.ink, borderLeft: `3px solid ${st.bar}` }}
                        title={`${t} ${st.label}${e.courseTitle ? ` · ${e.courseTitle}` : ""}`}
                      >
                        {t} {st.short}
                        {e.courseTitle ? ` · ${e.courseTitle}` : ""}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: "var(--ink3)", paddingLeft: 2 }}>
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
                <div className="cal-dots">
                  {dayEvents.slice(0, 4).map((e) => (
                    <span key={e.id} style={{ width: 4, height: 4, borderRadius: "50%", background: eventColor(e.type) }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right rail: the design specifies the day agenda only; To-do + Upcoming are kept
          stacked beneath it so the existing todosApi wiring isn't lost. */}
      <div className="cal-right">
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {sameDay(selectedDate, today) ? "Today · " : ""}
          {selectedDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 16, marginTop: 2 }}>
          {selectedEvents.length === 0 ? "No events" : `${selectedEvents.length} event${selectedEvents.length === 1 ? "" : "s"}`}
        </div>
        {selectedEvents.length === 0 ? (
          <p style={{ color: "var(--ink3)", fontSize: 12.5 }}>Nothing scheduled this day.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {selectedEvents.map((e) =>
              isCurrentlyLive(e, today) ? (
                <LiveNowCard key={e.id} event={e} role={role} />
              ) : (
                <EventRow key={e.id} event={e} role={role} />
              ),
            )}
          </div>
        )}

        <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
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
    </div>
  );
}
