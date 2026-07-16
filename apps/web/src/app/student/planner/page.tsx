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

/**
 * Reflections are keyed by day, and the API truncates the incoming date to UTC
 * midnight (ReflectionsService.dayOnly). So "today" must be sent as UTC midnight of
 * the LOCAL date — sending local midnight lands on the previous day anywhere east of
 * UTC (in IST, 16 Jul 00:00 local is 15 Jul 18:30Z, which truncates to 15 Jul).
 * Read-side keys/labels therefore have to read UTC parts back, not local ones.
 */
function utcDayIso(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
}

function utcDayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function localDayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "Mon 6 Jul" for a UTC-midnight day value (reflections), read in UTC. */
function utcDayLabel(iso: string) {
  const d = new Date(iso);
  const opts = { timeZone: "UTC" } as const;
  const wd = d.toLocaleDateString(undefined, { weekday: "short", ...opts });
  const mon = d.toLocaleDateString(undefined, { month: "short", ...opts });
  return `${wd} ${d.getUTCDate()} ${mon}`;
}

/** "Mon 6 Jul" — day-before-month, matching the design (a month-first locale would
 *  otherwise render "Mon, Jul 6"). */
function dayLabel(d: Date) {
  const wd = d.toLocaleDateString(undefined, { weekday: "short" });
  const mon = d.toLocaleDateString(undefined, { month: "short" });
  return `${wd} ${d.getDate()} ${mon}`;
}

/**
 * "6–12 Jul" for a week inside one month, "29 Jun–5 Jul" when it spans two.
 * Built by hand rather than via toLocaleDateString on both ends, since a
 * month-first locale would render the range as "13–Jul 19".
 */
function weekRangeLabel(start: Date, end: Date) {
  const mon = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${mon(end)}`
    : `${start.getDate()} ${mon(start)}–${end.getDate()} ${mon(end)}`;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

type TtView = "month" | "week" | "day";

/** TIME presets replace the old free time input — the design offers four chips. */
const TIME_CHIPS = ["06:00", "09:00", "14:00", "19:00"];
/** The four types a student can schedule for themselves (NOTES is faculty-published). */
const TYPE_CHIPS: PlanItemType[] = ["PRACTICE", "TEST", "VIDEO", "OTHER"];

function TimetableTab() {
  const [view, setView] = useState<TtView>("week");
  const [anchor, setAnchor] = useState(() => todayMidnight());
  const [selected, setSelected] = useState(() => todayMidnight());
  const [items, setItems] = useState<StudyPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [time, setTime] = useState(TIME_CHIPS[1]);
  const [type, setType] = useState<PlanItemType>("PRACTICE");
  const [adding, setAdding] = useState(false);

  // The visible window drives the fetch: whole month for month view, the anchor's
  // week for week view, and the selected day for day view.
  const [rangeStart, rangeEnd] = useMemo<[Date, Date]>(() => {
    if (view === "month") {
      const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const e = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
      return [s, e];
    }
    if (view === "day") {
      const s = new Date(selected);
      const e = new Date(selected);
      e.setDate(e.getDate() + 1);
      return [s, e];
    }
    const s = startOfWeek(anchor);
    const e = new Date(s);
    e.setDate(e.getDate() + 7);
    return [s, e];
  }, [view, anchor, selected]);

  function load() {
    setLoading(true);
    planApi
      .mine({ from: rangeStart.toISOString(), to: rangeEnd.toISOString() })
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load plan"))
      .finally(() => setLoading(false));
  }
  useEffect(load, [rangeStart, rangeEnd]);

  const weekDays = useMemo(() => {
    const s = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [anchor]);

  const monthCells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [anchor]);

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

  function shift(delta: number) {
    setAnchor((a) => {
      const n = new Date(a);
      if (view === "month") n.setMonth(n.getMonth() + delta);
      else if (view === "day") n.setDate(n.getDate() + delta);
      else n.setDate(n.getDate() + delta * 7);
      return n;
    });
    if (view === "day") setSelected((s) => { const n = new Date(s); n.setDate(n.getDate() + delta); return n; });
  }

  function pickDay(d: Date) {
    setSelected(d);
    setAnchor(d);
    setView("day");
  }

  const rangeLabel =
    view === "month"
      ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "day"
        ? dayLabel(selected)
        : weekRangeLabel(weekDays[0], weekDays[6]);

  async function onAddPersonal() {
    if (!title.trim()) {
      setError("Give your plan item a title.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const [h, m] = time.split(":").map(Number);
      const when = new Date(selected);
      when.setHours(h, m, 0, 0);
      await planApi.createMine({ scheduledFor: when.toISOString(), type, title: title.trim() });
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
  const itemsThisWeek = items.length;

  return (
    <div style={{ animation: "fadeInUp .25s ease" }}>
      {/* View switcher + range nav + type legend (design screen 4). */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="tt-switch">
          {(["month", "week", "day"] as TtView[]).map((v) => (
            <div key={v} onClick={() => setView(v)} className={`tt-switch-item${view === v ? " tt-switch-on" : ""}`}>
              {v[0].toUpperCase() + v.slice(1)}
            </div>
          ))}
        </div>
        <button onClick={() => shift(-1)} style={navBtn} aria-label="Previous">‹</button>
        <button onClick={() => shift(1)} style={navBtn} aria-label="Next">›</button>
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>{rangeLabel}</span>
        <div style={{ flex: 1 }} />
        <div className="tt-legend">
          {(Object.keys(PLAN_TYPE_META) as PlanItemType[]).map((t) => (
            <span key={t} style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 10.5, fontWeight: 500, color: "var(--ink2)" }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: PLAN_TYPE_META[t].ink }} />
              {PLAN_TYPE_META[t].label}
            </span>
          ))}
        </div>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink3)", fontSize: 13 }}>Loading…</p>
      ) : view === "week" ? (
        <div className="tt-week">
          {weekDays.map((d) => {
            const key = localKey(d);
            const dayItems = itemsByDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isSel = key === localKey(selected);
            return (
              <div key={key} style={{ minWidth: 0 }}>
                <div
                  onClick={() => pickDay(d)}
                  className="tt-week-head"
                  style={{
                    background: isToday ? "var(--orange)" : isSel ? "var(--orange-soft)" : "var(--card)",
                    color: isToday ? "#fff" : "var(--ink2)",
                    border: `1px solid ${isToday ? "var(--orange)" : isSel ? "var(--orange)" : "var(--line)"}`,
                  }}
                >
                  <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: 0.5, opacity: 0.75 }}>
                    {d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--font-mono)" }}>{d.getDate()}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, minHeight: 130 }}>
                  {dayItems.map((it) => {
                    const meta = PLAN_TYPE_META[it.type];
                    const href = planHref(it);
                    const card = (
                      <div className="tt-card" style={{ borderLeft: `3px solid ${meta.ink}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 8.5, fontWeight: 700, color: meta.ink, background: meta.bg, borderRadius: 4, padding: "2px 5px" }}>
                            {meta.label}
                          </span>
                          {it.source === "personal" && (
                            <span
                              onClick={(e) => { e.preventDefault(); onDelete(it); }}
                              className="pl-task-del"
                              style={{ marginLeft: 0, fontSize: 11 }}
                            >
                              ✕
                            </span>
                          )}
                        </div>
                        <div className="tt-card-title">{it.title}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink3)", marginTop: 4 }}>
                          {new Date(it.scheduledFor).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })} ·{" "}
                          {it.source === "personal" ? "You" : it.batch?.name ?? "Batch"}
                        </div>
                      </div>
                    );
                    return href ? (
                      <Link key={it.id} href={href} style={{ textDecoration: "none", color: "inherit" }}>{card}</Link>
                    ) : (
                      <div key={it.id}>{card}</div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === "month" ? (
        <div>
          <div className="tt-month-dows">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="tt-month-dow">{d}</div>
            ))}
          </div>
          <div className="tt-month-grid">
            {monthCells.map((d) => {
              const key = localKey(d);
              const dayItems = itemsByDay.get(key) ?? [];
              const inMonth = d.getMonth() === anchor.getMonth();
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  onClick={() => pickDay(d)}
                  className="tt-month-cell"
                  style={{ opacity: inMonth ? 1 : 0.45 }}
                >
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <span
                      className="cal-daynum"
                      style={isToday ? { background: "var(--orange)", color: "#fff", borderRadius: 999, fontFamily: "var(--font-mono)" } : { color: "var(--ink2)" }}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                  <div className="cal-chips">
                    {dayItems.slice(0, 3).map((it) => {
                      const meta = PLAN_TYPE_META[it.type];
                      return (
                        <div key={it.id} className="cal-chip" style={{ background: meta.bg, color: meta.ink, borderLeft: `3px solid ${meta.ink}` }}>
                          {new Date(it.scheduledFor).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })} {it.title}
                        </div>
                      );
                    })}
                    {dayItems.length > 3 && (
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: "var(--ink3)", paddingLeft: 2 }}>+{dayItems.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 8 }}>Tap a date to open its day view.</div>
        </div>
      ) : (
        <div style={{ maxWidth: 680 }}>
          {(itemsByDay.get(localKey(selected)) ?? []).length === 0 ? (
            <div className="tt-day-empty">Nothing planned for {dayLabel(selected)} — add your own plan below 🌤</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(itemsByDay.get(localKey(selected)) ?? []).map((it) => {
                const meta = PLAN_TYPE_META[it.type];
                const href = planHref(it);
                const row = (
                  <div className="tt-day-row">
                    <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink2)", width: 44, flex: "none" }}>
                      {new Date(it.scheduledFor).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                    <span style={{ fontSize: 8.5, fontWeight: 700, color: meta.ink, background: meta.bg, borderRadius: 4, padding: "2px 6px", flex: "none" }}>
                      {meta.label}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {it.title}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink3)", flex: "none" }}>
                      {it.source === "personal" ? "You" : it.batch?.name ?? "Batch"}
                    </span>
                    {it.source === "personal" && (
                      <span onClick={(e) => { e.preventDefault(); onDelete(it); }} className="pl-task-del" style={{ marginLeft: 0 }}>✕</span>
                    )}
                  </div>
                );
                return href ? (
                  <Link key={it.id} href={href} style={{ textDecoration: "none", color: "inherit" }}>{row}</Link>
                ) : (
                  <div key={it.id}>{row}</div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add your own plan — the date comes from the grid selection, not a date input. */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: "16px 18px", marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Add your own plan</span>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--ink2)" }}>
            adds to <b style={{ color: "#b9400d" }}>{dayLabel(selected)}</b> · pick any date above to change
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Practice DI set / Mock 3 review"
            className="tt-add-input"
          />
          <button
            onClick={onAddPersonal}
            disabled={adding || !title.trim()}
            style={{
              fontSize: 13,
              fontWeight: 700,
              background: "var(--orange)",
              color: "#fff",
              border: "none",
              borderRadius: 11,
              height: 42,
              padding: "0 20px",
              fontFamily: "inherit",
              flex: "none",
              cursor: adding || !title.trim() ? "default" : "pointer",
              opacity: adding || !title.trim() ? 0.6 : 1,
            }}
          >
            {adding ? "Adding…" : "+ Add plan"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span className="tt-chip-label">TYPE</span>
            {TYPE_CHIPS.map((t) => {
              const meta = PLAN_TYPE_META[t];
              const on = type === t;
              return (
                <span
                  key={t}
                  onClick={() => setType(t)}
                  className={`tt-chip${on ? " tt-chip-on" : ""}`}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: meta.ink, flex: "none" }} />
                  {meta.label}
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span className="tt-chip-label">TIME</span>
            {TIME_CHIPS.map((t) => (
              <span key={t} onClick={() => setTime(t)} className={`tt-chip${time === t ? " tt-chip-on" : ""}`}>
                {t}
              </span>
            ))}
          </div>
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

  // Stored reflections are UTC-midnight day values, so "today" is the local date
  // compared against the row's UTC parts — see utcDayIso/utcDayKey.
  const todayKey = localDayKey(new Date());

  function load() {
    setLoading(true);
    reflectionsApi
      .listMine(30)
      .then((rs) => {
        setReflections(rs);
        const today = rs.find((r) => utcDayKey(r.date) === todayKey);
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
      await reflectionsApi.upsertMine({ date: utcDayIso(new Date()), wentWell: wentWell.trim() || undefined, toImprove: toImprove.trim() || undefined });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save reflection");
    } finally {
      setSaving(false);
    }
  }

  const past = reflections.filter((r) => utcDayKey(r.date) !== todayKey);
  const savedToday = reflections.some((r) => utcDayKey(r.date) === todayKey);
  const canSave = !!wentWell.trim() || !!toImprove.trim();

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading…</p>;

  return (
    <div className="pl-reflect-grid">
      {/* Warm "today" card — gradient + amber border per design screen 4. */}
      <div className="pl-reflect-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#b9400d" }}>
            Today · {dayLabel(new Date())}
          </span>
          {savedToday && (
            <span className="pop-in" style={{ fontSize: 10.5, fontWeight: 600, background: "var(--green-soft)", color: "var(--green)", borderRadius: 999, padding: "4px 10px" }}>
              ✓ Saved
            </span>
          )}
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", marginBottom: 6 }}>🌱 What went well</div>
        <textarea
          value={wentWell}
          onChange={(e) => setWentWell(e.target.value)}
          className="pl-reflect-area"
        />

        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--orange-ink)", margin: "12px 0 6px" }}>🎯 To improve</div>
        <textarea
          value={toImprove}
          onChange={(e) => setToImprove(e.target.value)}
          className="pl-reflect-area"
        />

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 12 }}>{error}</p>}

        <button
          onClick={onSave}
          disabled={saving || !canSave}
          style={{
            fontSize: 13,
            fontWeight: 600,
            background: "var(--orange)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            height: 38,
            padding: "0 18px",
            marginTop: 14,
            fontFamily: "inherit",
            cursor: saving || !canSave ? "default" : "pointer",
            opacity: saving || !canSave ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : savedToday ? "Update reflection" : "Save reflection"}
        </button>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Past entries</div>
        {past.length === 0 ? (
          <p style={{ color: "var(--ink3)", fontSize: 12.5 }}>No past entries yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {past.map((r) => (
              <div key={r.id} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: "13px 15px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink3)", marginBottom: 6 }}>
                  {utcDayLabel(r.date)}
                </div>
                {r.wentWell && <div style={{ fontSize: 12, lineHeight: 1.55, color: "#403b35" }}>🌱 {r.wentWell}</div>}
                {r.toImprove && <div style={{ fontSize: 12, lineHeight: 1.55, color: "#403b35", marginTop: 4 }}>🎯 {r.toImprove}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
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

  const tasksLeft = todayTasks.filter((t) => !t.completed).length;

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Add row sits above the list, with the design's black CTA. */}
      <form onSubmit={onAdd} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task for today…"
          className="pl-task-input"
        />
        <button
          type="submit"
          disabled={adding || !text.trim()}
          style={{
            fontSize: 13,
            fontWeight: 600,
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 11,
            height: 42,
            padding: "0 18px",
            fontFamily: "inherit",
            flex: "none",
            cursor: adding || !text.trim() ? "default" : "pointer",
            opacity: adding || !text.trim() ? 0.6 : 1,
          }}
        >
          + Add
        </button>
      </form>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--line2)" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>Today</span>
          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--ink2)" }}>{tasksLeft} left</span>
        </div>

        {loading ? (
          <p style={{ color: "var(--ink3)", fontSize: 13, padding: 26, textAlign: "center" }}>Loading…</p>
        ) : todayTasks.length === 0 ? (
          <div style={{ padding: 26, textAlign: "center", fontSize: 13, color: "var(--ink3)" }}>
            All clear — add your first task above 🌤
          </div>
        ) : (
          todayTasks.map((t) => (
            <div key={t.id} className="pl-task-row">
              <button
                onClick={() => onToggle(t)}
                aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
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
                  <svg width="10" height="8" viewBox="0 0 10 8">
                    <polyline points="1,4 4,7 9,1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
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
                aria-label="Delete task"
                className="pl-task-del"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
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
    <main className="fade-in mobile-page-pad" style={{ padding: "24px 28px 32px", maxWidth: 880, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.22 }}>Planner</div>

      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--line)", marginTop: 14, marginBottom: 22 }}>
        {tabs.map((t) => (
          <div
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "12px 16px",
              fontSize: 13,
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? "var(--orange-deep)" : "var(--ink2)",
              borderBottom: tab === t.key ? "2px solid var(--orange)" : "2px solid transparent",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {tab === "timetable" && <TimetableTab />}
      {tab === "reflection" && <ReflectionTab />}
      {tab === "tasks" && <TasksTab />}
    </main>
  );
}
