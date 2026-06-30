"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { enrollmentsApi, coursesApi, testsApi, testAttemptsApi, mentorApi, calendarApi, usersApi, ApiError, type MentorBooking, type CalendarEvent, type Profile, type ActivityDay } from "@/lib/api";

interface ScoredAttempt {
  pct: number;
  submittedAt: string;
}

interface CourseProgress {
  id: string;
  title: string;
  total: number;
  viewed: number;
  pct: number;
}

/** Eased count-up for headline numbers — runs once on mount / when target changes. */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const BRAND_GRADIENT_FROM = "#f7902b";
const BRAND_GRADIENT_TO = "#f24d1b";

function PerformanceRing({ pct }: { pct: number | null }) {
  const value = pct ?? 0;
  const r = 62;
  const c = 2 * Math.PI * r;
  const arc = (value / 100) * c;
  const display = useCountUp(value, 1100);
  return (
    <div style={{ position: "relative", width: 160, height: 160, margin: "10px auto 0" }}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        <defs>
          <linearGradient id="perfGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={BRAND_GRADIENT_FROM} />
            <stop offset="100%" stopColor={BRAND_GRADIENT_TO} />
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
        {pct !== null && (
          <circle
            cx="80"
            cy="80"
            r={r}
            fill="none"
            stroke="url(#perfGrad)"
            strokeWidth="14"
            strokeDasharray={`${arc} ${c}`}
            strokeLinecap="round"
            transform="rotate(-90 80 80)"
            style={{ ["--ring-arc" as string]: `${arc}`, strokeDashoffset: 0, animation: "ringDraw 1.1s cubic-bezier(.2,.7,.3,1) both" } as React.CSSProperties}
          />
        )}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>{pct !== null ? `${Math.round(display)}%` : "—"}</div>
        <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600, letterSpacing: 0.3 }}>Avg score</div>
      </div>
    </div>
  );
}

const CHART_H = 150;

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function ExamScoresChart({ attempts }: { attempts: ScoredAttempt[] }) {
  const last = attempts.slice(-8);
  const avg = last.reduce((s, a) => s + a.pct, 0) / last.length;
  return (
    <div>
      <div style={{ position: "relative", height: CHART_H, marginLeft: 4 }}>
        {[100, 75, 50, 25].map((g) => (
          <div key={g} style={{ position: "absolute", left: 0, right: 0, bottom: (g / 100) * CHART_H, borderTop: "1px dashed var(--line)" }}>
            <span style={{ position: "absolute", left: -2, top: -7, fontSize: 9, color: "var(--ink3)", fontWeight: 600 }}>{g}</span>
          </div>
        ))}
        {Number.isFinite(avg) && (
          <div style={{ position: "absolute", left: 18, right: 0, bottom: (avg / 100) * CHART_H, borderTop: "1.5px dashed var(--orange)" }}>
            <span style={{ position: "absolute", right: 0, top: -9, fontSize: 9.5, fontWeight: 700, color: "var(--orange)", background: "var(--orange-soft)", padding: "1px 6px", borderRadius: 6 }}>
              avg {Math.round(avg)}%
            </span>
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, paddingLeft: 18, display: "flex", alignItems: "flex-end", gap: 8 }}>
          {last.map((a, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink2)" }}>{Math.round(a.pct)}</div>
              <div
                className="dash-bar"
                title={`${Math.round(a.pct)}% · ${shortDate(a.submittedAt)}`}
                style={{
                  width: "100%",
                  maxWidth: 30,
                  height: Math.max((a.pct / 100) * (CHART_H - 18), 3),
                  background: `linear-gradient(180deg, ${BRAND_GRADIENT_FROM}, ${BRAND_GRADIENT_TO})`,
                  borderRadius: "7px 7px 0 0",
                  animationDelay: `${i * 70}ms`,
                  boxShadow: "0 2px 6px rgba(242,106,27,.22)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, paddingLeft: 18, marginTop: 6 }}>
        {last.map((a, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "var(--ink3)", fontWeight: 600 }}>{shortDate(a.submittedAt)}</div>
        ))}
      </div>
    </div>
  );
}

function ScoreTrendChart({ attempts }: { attempts: ScoredAttempt[] }) {
  const pts = attempts.slice(-10);
  if (pts.length < 2) return null;
  const W = 600;
  const H = 170;
  const padX = 10;
  const padY = 18;
  const n = pts.length;
  const coords = pts.map((a, i) => {
    const x = padX + (i / (n - 1)) * (W - 2 * padX);
    const y = padY + (1 - a.pct / 100) * (H - 2 * padY);
    return { x, y, a };
  });
  const linePath = coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${coords[n - 1].x.toFixed(1)} ${H - padY} L ${coords[0].x.toFixed(1)} ${H - padY} Z`;
  let len = 0;
  for (let i = 1; i < coords.length; i++) {
    len += Math.hypot(coords[i].x - coords[i - 1].x, coords[i].y - coords[i - 1].y);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="180" style={{ display: "block" }}>
      <defs>
        <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(242,106,27,.22)" />
          <stop offset="100%" stopColor="rgba(242,106,27,0)" />
        </linearGradient>
        <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={BRAND_GRADIENT_FROM} />
          <stop offset="100%" stopColor={BRAND_GRADIENT_TO} />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={padX} x2={W - padX} y1={padY + g * (H - 2 * padY)} y2={padY + g * (H - 2 * padY)} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      <path d={areaPath} fill="url(#trendArea)" className="fade-in" />
      <path
        d={linePath}
        fill="none"
        stroke="url(#trendLine)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ ["--line-len" as string]: `${len}`, strokeDasharray: len, strokeDashoffset: 0, animation: "lineDraw 1.2s cubic-bezier(.3,.7,.3,1) both" } as React.CSSProperties}
      />
      {coords.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="var(--card)" stroke="var(--orange)" strokeWidth="2.5" className="fade-in" style={{ animationDelay: `${500 + i * 60}ms` }}>
          <title>{`${Math.round(p.a.pct)}% · ${shortDate(p.a.submittedAt)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function CompletionDonut({ completed, inProgress, notStarted }: { completed: number; inProgress: number; notStarted: number }) {
  const total = completed + inProgress + notStarted;
  const r = 54;
  const c = 2 * Math.PI * r;
  const segments = [
    { v: completed, color: "var(--green)" },
    { v: inProgress, color: "var(--orange)" },
    { v: notStarted, color: "var(--line)" },
  ].filter((s) => s.v > 0);
  const display = useCountUp(completed);
  let cum = 0;
  return (
    <div style={{ position: "relative", width: 150, height: 150, margin: "0 auto" }}>
      <svg width="150" height="150" viewBox="0 0 150 150">
        {total === 0 && <circle cx="75" cy="75" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />}
        {segments.map((s, i) => {
          const frac = s.v / total;
          const arc = frac * c;
          const rot = -90 + cum * 360;
          cum += frac;
          return (
            <circle
              key={i}
              cx="75"
              cy="75"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${arc} ${c}`}
              transform={`rotate(${rot} 75 75)`}
              style={{ ["--ring-arc" as string]: `${arc}`, strokeDashoffset: 0, animation: "ringDraw .9s cubic-bezier(.2,.7,.3,1) both", animationDelay: `${i * 0.22}s` } as React.CSSProperties}
            />
          );
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{Math.round(display)}</div>
        <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>of {total} done</div>
      </div>
    </div>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flex: "none" }} />
      <span style={{ color: "var(--ink2)", fontWeight: 600 }}>{label}</span>
      <span style={{ marginLeft: "auto", fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function CourseProgressBars({ courses }: { courses: CourseProgress[] }) {
  const sorted = [...courses].sort((a, b) => b.pct - a.pct);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {sorted.map((cp, i) => (
        <div key={cp.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cp.title}</span>
            <span style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 600, flex: "none" }}>
              {cp.total === 0 ? "No lessons yet" : `${cp.viewed}/${cp.total} · ${Math.round(cp.pct)}%`}
            </span>
          </div>
          <div style={{ height: 9, background: "var(--line2)", borderRadius: 6, overflow: "hidden" }}>
            <div
              className="dash-bar-x"
              style={{
                width: `${cp.pct}%`,
                height: "100%",
                borderRadius: 6,
                background: cp.pct >= 100 ? "var(--green)" : `linear-gradient(90deg, ${BRAND_GRADIENT_FROM}, ${BRAND_GRADIENT_TO})`,
                animationDelay: `${i * 90}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const HEAT_WEEKS = 17;
const DAY_MS = 86400000;
const HEAT_COLORS = ["var(--line2)", "rgba(242,106,27,.28)", "rgba(242,106,27,.5)", "rgba(242,106,27,.74)", "var(--orange)"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function heatLevel(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

function ActivityHeatmap({ activity }: { activity: ActivityDay[] }) {
  const counts = new Map(activity.map((a) => [a.date, a.count]));
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startRaw = todayUTC - (HEAT_WEEKS * 7 - 1) * DAY_MS;
  const startUTC = startRaw - new Date(startRaw).getUTCDay() * DAY_MS; // back to Sunday

  const weeks: { ts: number; key: string; count: number; future: boolean }[][] = [];
  let totalViews = 0;
  for (let w = 0; w < HEAT_WEEKS; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const ts = startUTC + (w * 7 + d) * DAY_MS;
      const key = new Date(ts).toISOString().slice(0, 10);
      const count = counts.get(key) ?? 0;
      totalViews += count;
      col.push({ ts, key, count, future: ts > todayUTC });
    }
    weeks.push(col);
  }

  let streak = 0;
  for (let i = 0; ; i++) {
    const key = new Date(todayUTC - i * DAY_MS).toISOString().slice(0, 10);
    if ((counts.get(key) ?? 0) > 0) streak++;
    else break;
  }

  const CELL = 13;
  const GAP = 3;
  const monthLabels = weeks.map((col, w) => {
    const m = new Date(col[0].ts).getUTCMonth();
    const prevM = w > 0 ? new Date(weeks[w - 1][0].ts).getUTCMonth() : -1;
    return m !== prevM ? MONTH_NAMES[m] : "";
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.6, color: "var(--orange)" }}>
          {streak} <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)" }}>day streak</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink3)", fontWeight: 600 }}>{totalViews} lessons opened in {HEAT_WEEKS} weeks</div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: GAP, height: 12 }}>
            {monthLabels.map((label, w) => (
              <div key={w} style={{ width: CELL, fontSize: 9, color: "var(--ink3)", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: GAP }}>
            {weeks.map((col, w) => (
              <div key={w} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                {col.map((cell) => (
                  <div
                    key={cell.key}
                    title={cell.future ? "" : `${cell.count} lesson${cell.count === 1 ? "" : "s"} · ${cell.key}`}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 3,
                      background: cell.future ? "transparent" : HEAT_COLORS[heatLevel(cell.count)],
                      border: cell.ts === todayUTC ? "1.5px solid var(--ink)" : "none",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 10.5, color: "var(--ink3)", fontWeight: 600 }}>
        Less
        {HEAT_COLORS.map((c, i) => (
          <span key={i} style={{ width: 11, height: 11, borderRadius: 3, background: c }} />
        ))}
        More
      </div>
    </div>
  );
}

function MentorTimeline({ bookings }: { bookings: MentorBooking[] }) {
  const now = Date.now();
  function status(b: MentorBooking) {
    if (b.cancelledAt) return { label: "Cancelled", color: "var(--ink3)", dot: "var(--line)" };
    if (new Date(b.date).getTime() < now) return { label: "Completed", color: "var(--green)", dot: "var(--green)" };
    return { label: "Upcoming", color: "var(--orange)", dot: "var(--orange)" };
  }
  const upcoming = bookings.filter((b) => !b.cancelledAt && new Date(b.date).getTime() >= now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const rest = bookings.filter((b) => b.cancelledAt || new Date(b.date).getTime() < now).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const ordered = [...upcoming, ...rest].slice(0, 6);

  if (ordered.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 14 }}>No mentor sessions yet.</p>
        <Link href="/student/mentor" style={{ display: "inline-block", padding: "9px 18px", background: "var(--ink)", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
          Book a mentor
        </Link>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", paddingLeft: 6 }}>
      {ordered.map((b, i) => {
        const s = status(b);
        const date = new Date(b.date);
        const last = i === ordered.length - 1;
        return (
          <div key={b.id} style={{ display: "flex", gap: 14, position: "relative" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: s.dot, border: "2px solid var(--card)", boxShadow: `0 0 0 2px ${s.dot}`, marginTop: 4, flex: "none" }} />
              {!last && <span style={{ width: 2, flex: 1, background: "var(--line)", marginTop: 4 }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : 18, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{b.mentor?.fullName ?? "Mentor session"}</div>
              <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>
                {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </div>
              <span style={{ display: "inline-block", marginTop: 6, fontSize: 10.5, fontWeight: 700, color: s.color, background: "var(--bg)", padding: "2px 9px", borderRadius: 6 }}>{s.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const LIVE_WINDOW_BEFORE_MIN = 10;
const LIVE_WINDOW_AFTER_MIN = 90;

function isCurrentlyLive(event: CalendarEvent, now: Date) {
  if (event.type !== "LIVE_LESSON") return false;
  const diffMin = (now.getTime() - new Date(event.date).getTime()) / 60000;
  return diffMin >= -LIVE_WINDOW_BEFORE_MIN && diffMin <= LIVE_WINDOW_AFTER_MIN;
}

function StatCard({ icon, count, unit, label, color, soft, delay }: { icon: React.ReactNode; count: number; unit: string; label: string; color: string; soft: string; delay: number }) {
  const display = useCountUp(count);
  return (
    <div
      className="entity-card fade-in-up"
      style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, animationDelay: `${delay}ms` }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 14, background: soft, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color, whiteSpace: "nowrap" }}>
          {Math.round(display)} {unit}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function PlayIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function LiveIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="m23 7-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}

function EventMentorIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function UnlockIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </svg>
  );
}

function TestIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function eventIcon(type: CalendarEvent["type"]) {
  if (type === "LIVE_LESSON") return <LiveIcon color="var(--orange)" />;
  if (type === "CHAPTER_UNLOCK") return <UnlockIcon color="var(--green)" />;
  if (type === "TEST") return <TestIcon color="var(--orange)" />;
  return <EventMentorIcon color="var(--purple)" />;
}

function eventSub(event: CalendarEvent) {
  if (event.type === "LIVE_LESSON" || event.type === "CHAPTER_UNLOCK") return event.courseTitle ?? "";
  if (event.type === "TEST") return "Test";
  return event.otherPartyName ? `with ${event.otherPartyName}` : "Mentor session";
}

function eventHref(event: CalendarEvent) {
  if ((event.type === "LIVE_LESSON" || event.type === "CHAPTER_UNLOCK") && event.courseId) return `/student/courses/${event.courseId}`;
  if (event.type === "TEST" && event.testId) return `/student/mock-test/${event.testId}`;
  return null;
}

function ScheduleRow({ event }: { event: CalendarEvent }) {
  const date = new Date(event.date);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const href = eventHref(event);
  const content = (
    <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "13px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ width: 56, flex: "none", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>{eventIcon(event.type)}</div>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: -0.3, marginTop: 2 }}>{time}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</div>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>{eventSub(event)}</div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
        {content}
      </Link>
    );
  }
  return content;
}

function DashboardSkeleton() {
  return (
    <main className="fade-in mobile-page-pad" style={{ padding: "30px 30px 60px" }}>
      <div className="dash-skeleton" style={{ height: 22, width: 140, marginBottom: 8, borderRadius: 8 }} />
      <div className="dash-skeleton" style={{ height: 28, width: 220, marginBottom: 22, borderRadius: 8 }} />
      <div className="mobile-stack-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 18, marginBottom: 18 }}>
        <div className="dash-skeleton" style={{ height: 250 }} />
        <div className="dash-skeleton" style={{ height: 250 }} />
      </div>
      <div className="mobile-stat-strip" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 64px", gap: 18, marginBottom: 18 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dash-skeleton" style={{ height: 78 }} />
        ))}
      </div>
      <div className="dash-skeleton" style={{ height: 220 }} />
    </main>
  );
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [attempts, setAttempts] = useState<ScoredAttempt[]>([]);
  const [bookings, setBookings] = useState<MentorBooking[]>([]);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const enrollments = await enrollmentsApi.mine();
        setEnrolledCount(enrollments.length);

        // Per-course progress (lessons viewed ÷ total) — fetched in parallel so the
        // dashboard isn't serialised on N course-tree round-trips.
        const trees = await Promise.all(enrollments.map((e) => coursesApi.get(e.courseId).catch(() => null)));
        setCourseProgress(
          trees.map((tree, i) => {
            if (!tree) return { id: enrollments[i].courseId, title: enrollments[i].course.title, total: 0, viewed: 0, pct: 0 };
            const lessons = tree.chapters.flatMap((ch) => ch.lessons);
            const total = lessons.length;
            const viewed = lessons.filter((l) => l.viewed).length;
            return { id: tree.id, title: tree.title, total, viewed, pct: total ? (viewed / total) * 100 : 0 };
          }),
        );

        const allAttempts: ScoredAttempt[] = [];
        for (const e of enrollments) {
          const tests = await testsApi.list({ courseId: e.courseId });
          for (const t of tests.filter((t) => t.published)) {
            const myAttempts = await testAttemptsApi.mine(t.id).catch(() => []);
            for (const a of myAttempts) {
              if (a.status === "SUBMITTED" && a.score !== null && a.maxScore) {
                allAttempts.push({ pct: (a.score / a.maxScore) * 100, submittedAt: a.submittedAt ?? a.startedAt });
              }
            }
          }
        }
        allAttempts.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
        setAttempts(allAttempts);

        const myBookings = await mentorApi.listBookingsAsStudent().catch(() => []);
        setBookings(myBookings);

        const myActivity = await enrollmentsApi.activity().catch(() => []);
        setActivity(myActivity);

        const calendarEvents = await calendarApi.student().catch(() => []);
        setEvents(calendarEvents);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <main style={{ padding: "30px 30px 60px" }}>
        <p style={{ color: "var(--red)" }}>{error}</p>
      </main>
    );
  }

  const avgPct = attempts.length ? attempts.reduce((s, a) => s + a.pct, 0) / attempts.length : null;
  const bestPct = attempts.length ? Math.max(...attempts.map((a) => a.pct)) : null;
  const totalLessons = courseProgress.reduce((s, c) => s + c.total, 0);
  const totalViewed = courseProgress.reduce((s, c) => s + c.viewed, 0);
  const overallPct = totalLessons ? (totalViewed / totalLessons) * 100 : 0;
  const coursesCompleted = courseProgress.filter((c) => c.total > 0 && c.viewed === c.total).length;
  const coursesInProgress = courseProgress.filter((c) => c.viewed > 0 && c.viewed < c.total).length;
  const coursesNotStarted = courseProgress.filter((c) => c.viewed === 0).length;
  const today = new Date();
  const completedSessions = bookings.filter((b) => new Date(b.date) < today).length;
  const now = new Date();
  const todayEvents = events.filter((e) => sameDay(new Date(e.date), now)).sort((a, b) => a.date.localeCompare(b.date));
  const upcomingEvents = events
    .filter((e) => new Date(e.date).getTime() >= now.getTime() && !sameDay(new Date(e.date), now))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  const liveNowEvents = events.filter((e) => isCurrentlyLive(e, now));

  return (
    <main className="mobile-page-pad" style={{ padding: "30px 30px 60px" }}>
      {profile && (
        <div className="fade-in-up" style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: "var(--ink3)", fontWeight: 600 }}>
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.6, marginTop: 2 }}>
            Hi, {profile.fullName.split(" ")[0]} 👋
          </div>
          <div style={{ fontSize: 13.5, color: "var(--ink2)", fontWeight: 600, marginTop: 4 }}>
            {avgPct === null
              ? "Take your first mock test to start tracking your progress."
              : `You're averaging ${Math.round(avgPct)}% across ${attempts.length} mock test${attempts.length === 1 ? "" : "s"}${bestPct !== null ? ` · best ${Math.round(bestPct)}%` : ""}.`}
          </div>
        </div>
      )}

      {liveNowEvents.length > 0 && (
        <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 9 }}>
              <span className="live-pulse" style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--red)" }} />
              Live now
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--red)", background: "var(--red-soft)", padding: "4px 10px", borderRadius: 8 }}>
              {liveNowEvents.length} live
            </span>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {liveNowEvents.map((e) => {
              const content = (
                <div className="entity-card" style={{ border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 14, display: "flex", gap: 13, alignItems: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--orange-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <PlayIcon color="var(--orange)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>{e.courseTitle}</div>
                  </div>
                  <span style={{ padding: "8px 18px", background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 700, flex: "none" }}>
                    Join
                  </span>
                </div>
              );
              return e.courseId ? (
                <Link key={e.id} href={`/student/courses/${e.courseId}`} style={{ textDecoration: "none", color: "inherit" }}>
                  {content}
                </Link>
              ) : (
                <div key={e.id}>{content}</div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mobile-stack-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 18, marginBottom: 18 }}>
        <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, textAlign: "center", animationDelay: "60ms" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink2)" }}>Performance</div>
          </div>
          <PerformanceRing pct={avgPct} />
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)", marginTop: 8 }}>
            {avgPct === null ? "Take a mock test to see your performance." : avgPct >= 70 ? "You did a great job!" : "Keep practicing — you're getting there."}
          </div>
        </div>

        <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, animationDelay: "120ms" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Today&apos;s Schedule</div>
            <Link href="/student/calendar" style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)" }}>
              {now.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </Link>
          </div>
          {todayEvents.length === 0 ? (
            <div style={{ padding: "26px 0", textAlign: "center", color: "var(--ink3)", fontSize: 13.5, fontWeight: 600 }}>
              Nothing scheduled today.
            </div>
          ) : (
            <div>
              {todayEvents.map((e) => (
                <ScheduleRow key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mobile-stat-strip" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 64px", gap: 18, marginBottom: 18 }}>
        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.8">
              <path d="m12 2 9 5-9 5-9-5 9-5Z" />
              <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
            </svg>
          }
          count={enrolledCount}
          unit="Enrolled"
          label="Courses"
          color="var(--orange)"
          soft="var(--orange-soft)"
          delay={160}
        />

        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8">
              <path d="M9 11H3v9h6v-9ZM21 4h-6v16h6V4ZM15 9H9v11h6V9Z" />
            </svg>
          }
          count={attempts.length}
          unit="Taken"
          label="Mock tests"
          color="var(--blue)"
          soft="var(--blue-soft)"
          delay={220}
        />

        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.8">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          }
          count={bookings.length}
          unit="Booked"
          label="Mentor sessions"
          color="var(--purple)"
          soft="var(--purple-soft)"
          delay={280}
        />

        <button
          onClick={() => router.push("/student/mentor")}
          title="Book a Mentor"
          className="mentor-cta-btn fade-in-up"
          style={{ background: "var(--orange)", border: "none", borderRadius: "var(--rm)", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, cursor: "pointer", boxShadow: "0 4px 12px rgba(242,106,27,.32)", animationDelay: "340ms" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" style={{ flex: "none" }}>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
          <span className="mentor-cta-label" style={{ display: "none", color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" }}>
            Book a Mentor
          </span>
        </button>
      </div>

      {courseProgress.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>Course progress</div>
            <div style={{ fontSize: 12.5, color: "var(--ink2)", fontWeight: 600 }}>{Math.round(overallPct)}% of all lessons completed</div>
          </div>
          <div className="mobile-stack-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 18 }}>
            <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, textAlign: "center" }}>Courses</div>
              <CompletionDonut completed={coursesCompleted} inProgress={coursesInProgress} notStarted={coursesNotStarted} />
              <div style={{ display: "grid", gap: 9, marginTop: 18 }}>
                <LegendDot color="var(--green)" label="Completed" value={coursesCompleted} />
                <LegendDot color="var(--orange)" label="In progress" value={coursesInProgress} />
                <LegendDot color="var(--line)" label="Not started" value={coursesNotStarted} />
              </div>
            </div>
            <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, animationDelay: "80ms" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>By course</div>
                <Link href="/student/courses" style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)" }}>
                  View all
                </Link>
              </div>
              <CourseProgressBars courses={courseProgress} />
            </div>
          </div>
        </div>
      )}

      {(activity.length > 0 || bookings.length > 0) && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3, marginBottom: 14 }}>Study activity</div>
          <div className="mobile-stack-grid" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
            <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Lesson activity</div>
              <ActivityHeatmap activity={activity} />
            </div>
            <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, animationDelay: "80ms" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Mentor sessions</div>
                <Link href="/student/mentor" style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)" }}>
                  Book
                </Link>
              </div>
              <MentorTimeline bookings={bookings} />
            </div>
          </div>
        </div>
      )}

      {upcomingEvents.length > 0 && (
        <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Upcoming</div>
            <Link href="/student/calendar" style={{ fontSize: 13, fontWeight: 700, color: "var(--orange)" }}>
              View all
            </Link>
          </div>
          <div>
            {upcomingEvents.map((e) => (
              <ScheduleRow key={e.id} event={e} />
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3, marginBottom: 14 }}>Performance analytics</div>

        {attempts.length === 0 ? (
          <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: "40px 22px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--orange-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <TestIcon color="var(--orange)" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>No mock test data yet</div>
            <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 4, marginBottom: 16 }}>Take a mock test and your score trends will appear here.</div>
            <Link href="/student/mock-test" style={{ display: "inline-block", padding: "10px 22px", background: "var(--ink)", color: "#fff", borderRadius: 11, fontSize: 13.5, fontWeight: 700 }}>
              Browse mock tests
            </Link>
          </div>
        ) : (
          <>
            <div className="mobile-stack-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
              <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Exam scores</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 16 }}>Last {Math.min(attempts.length, 8)} mock test attempts</div>
                <ExamScoresChart attempts={attempts} />
              </div>

              <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, textAlign: "center", animationDelay: "80ms" }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Mentorship</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 10 }}>Sessions booked</div>
                {bookings.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--ink3)", marginTop: 20 }}>No mentor sessions booked yet.</p>
                ) : (
                  <>
                    <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, margin: "14px 0 8px", background: `linear-gradient(135deg, ${BRAND_GRADIENT_FROM}, ${BRAND_GRADIENT_TO})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                      {bookings.length}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink2)", fontWeight: 600 }}>{completedSessions} completed</div>
                  </>
                )}
              </div>
            </div>

            {attempts.length >= 2 && (
              <div className="fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, marginTop: 18, animationDelay: "120ms" }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Score trend</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 10 }}>Your last {Math.min(attempts.length, 10)} attempts over time</div>
                <ScoreTrendChart attempts={attempts} />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
