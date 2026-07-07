"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { enrollmentsApi, coursesApi, testsApi, testAttemptsApi, calendarApi, usersApi, reflectionsApi, ApiError, type CalendarEvent, type Profile, type ActivityDay, type Course, type Enrollment, type Reflection } from "@/lib/api";

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

function fmtPrice(course: Course) {
  if (course.type === "FREE" || !course.priceCents) return "Free";
  return `₹${Math.round(course.priceCents / 100).toLocaleString("en-IN")}`;
}

/** Compact enrolled-course card for "Continue learning" (thumbnail + progress). */
function ContinueCard({ course, pct }: { course: Course; pct: number }) {
  return (
    <Link
      href={`/student/courses/${course.id}`}
      className="entity-card"
      style={{ display: "flex", gap: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 16, textDecoration: "none", color: "inherit" }}
    >
      <div style={{ width: 104, height: 74, borderRadius: 12, flex: "none", overflow: "hidden", background: course.thumbnailUrl ? `url(${course.thumbnailUrl}) center/cover` : "var(--orange-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!course.thumbnailUrl && (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--orange)"><path d="M8 5v14l11-7z" /></svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{course.title}</div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, paddingTop: 10 }}>
          <div style={{ flex: 1, height: 6, background: "var(--line2)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${Math.round(pct)}%`, height: "100%", background: "var(--progress)", borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)" }}>{Math.round(pct)}%</span>
        </div>
      </div>
    </Link>
  );
}

/** Compact recommended-course card (badge + rating + price + enroll link). */
function RecCard({ course }: { course: Course }) {
  return (
    <Link
      href={`/student/courses?q=${encodeURIComponent(course.title)}`}
      className="entity-card"
      style={{ display: "block", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden", textDecoration: "none", color: "inherit" }}
    >
      <div style={{ height: 84, background: course.thumbnailUrl ? `url(${course.thumbnailUrl}) center/cover` : "linear-gradient(135deg,var(--orange-soft),var(--purple-soft))" }} />
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.4, minHeight: 38, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{course.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11.5, color: "var(--ink3)", fontWeight: 600 }}>
          {course.avgRating != null ? (
            <>
              <span style={{ color: "var(--amber)" }}>★</span>
              <span style={{ color: "var(--ink)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{course.avgRating.toFixed(1)}</span>
              {course.reviewCount ? <span>({course.reviewCount})</span> : null}
            </>
          ) : (
            <span>New</span>
          )}
          <span style={{ marginLeft: "auto", fontWeight: 800, color: fmtPrice(course) === "Free" ? "var(--green)" : "var(--ink)" }}>{fmtPrice(course)}</span>
        </div>
      </div>
    </Link>
  );
}

/** Small syllabus/on-track progress ring. */
function OnTrackRing({ pct }: { pct: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const arc = (pct / 100) * c;
  return (
    <svg width="88" height="88" viewBox="0 0 92 92" style={{ flex: "none" }}>
      <circle cx="46" cy="46" r={r} fill="none" stroke="var(--line2)" strokeWidth="9" />
      <circle cx="46" cy="46" r={r} fill="none" stroke="var(--progress)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${arc} ${c}`} transform="rotate(-90 46 46)" />
      <text x="46" y="44" textAnchor="middle" style={{ font: "800 19px var(--font-sans)", fill: "var(--ink)" }}>{Math.round(pct)}%</text>
      <text x="46" y="60" textAnchor="middle" style={{ font: "500 9px var(--font-sans)", fill: "var(--ink3)" }}>syllabus</text>
    </svg>
  );
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [attempts, setAttempts] = useState<ScoredAttempt[]>([]);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [catalog, setCatalog] = useState<Course[]>([]);
  const [todayReflection, setTodayReflection] = useState<Reflection | null>(null);

  useEffect(() => {
    usersApi.me().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const enrollments = await enrollmentsApi.mine();
        setEnrollments(enrollments);

        // Recommended = published catalog courses the student isn't already enrolled in.
        const enrolledIds = new Set(enrollments.map((e) => e.courseId));
        coursesApi.list().then((all) => setCatalog(all.filter((c) => !enrolledIds.has(c.id)))).catch(() => {});
        // Today's reflection (for the evening-reflection card).
        reflectionsApi
          .listMine(1)
          .then((list) => {
            const iso = new Date().toISOString().slice(0, 10);
            setTodayReflection(list.find((r) => r.date.slice(0, 10) === iso) ?? null);
          })
          .catch(() => {});

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
  const now = new Date();
  const todayEvents = events.filter((e) => sameDay(new Date(e.date), now)).sort((a, b) => a.date.localeCompare(b.date));
  const liveNowEvents = events.filter((e) => isCurrentlyLive(e, now));
  const liveEvent = liveNowEvents[0] ?? null;

  // Current study streak (consecutive days with ≥1 lesson opened), from the activity feed.
  const activityByDate = new Map(activity.map((a) => [a.date.slice(0, 10), a.count]));
  const DAY_MS_S = 86400000;
  const todayUTCs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let streak = 0;
  for (let i = 0; ; i++) {
    const key = new Date(todayUTCs - i * DAY_MS_S).toISOString().slice(0, 10);
    if ((activityByDate.get(key) ?? 0) > 0) streak++;
    else break;
  }

  // Continue learning: enrolled courses joined with their progress, in-progress first.
  const progressById = new Map(courseProgress.map((c) => [c.id, c]));
  const continueList = enrollments
    .map((e) => ({ course: e.course, prog: progressById.get(e.courseId) }))
    .sort((a, b) => {
      const ap = a.prog?.pct ?? 0;
      const bp = b.prog?.pct ?? 0;
      const rank = (p: number) => (p > 0 && p < 100 ? 0 : p === 0 ? 1 : 2);
      return rank(ap) - rank(bp) || bp - ap;
    })
    .slice(0, 4);

  // Recommended: highest-rated / most-enrolled catalog courses the student hasn't joined.
  const recommended = [...catalog]
    .sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1) || (b._count?.enrollments ?? 0) - (a._count?.enrollments ?? 0))
    .slice(0, 3);

  const firstName = profile?.fullName.split(" ")[0] ?? "there";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <main className="fade-in mobile-page-pad" style={{ padding: "30px 30px 60px" }}>
      {/* Greeting + streak */}
      <div className="fade-in-up mobile-stack-header" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--ink3)", fontWeight: 600 }}>
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.9, marginTop: 3 }}>
            {greeting}, {firstName} 👋
          </div>
        </div>
        {streak > 0 && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "10px 16px" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--orange-deep)" }}>🔥 {streak}</span>
            <span style={{ fontSize: 12, lineHeight: 1.3, color: "var(--ink2)", fontWeight: 500 }}>
              day study
              <br />
              streak
            </span>
          </div>
        )}
      </div>

      <div className="mobile-stack-grid" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24, alignItems: "start" }}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          {continueList.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.2 }}>Continue learning</div>
                <Link href="/student/courses" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--orange-deep)" }}>View all →</Link>
              </div>
              <div className="dash-continue-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {continueList.map(({ course, prog }) => (
                  <ContinueCard key={course.id} course={course} pct={prog?.pct ?? 0} />
                ))}
              </div>
            </div>
          )}

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 20 }}>
            <ActivityHeatmap activity={activity} />
          </div>

          {recommended.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.2 }}>Recommended for you</div>
                <Link href="/student/courses" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--orange-deep)" }}>Browse all →</Link>
              </div>
              <div className="dash-rec-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {recommended.map((c) => (
                  <RecCard key={c.id} course={c} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT RAIL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 20, display: "flex", gap: 18, alignItems: "center" }}>
            <OnTrackRing pct={overallPct} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{overallPct >= 70 ? "On track 🎯" : "Keep going 💪"}</div>
              <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--ink3)", marginTop: 4 }}>
                {avgPct === null
                  ? "Take a mock test to see how you're tracking."
                  : `Averaging ${Math.round(avgPct)}% across ${attempts.length} mock test${attempts.length === 1 ? "" : "s"}${bestPct !== null ? ` · best ${Math.round(bestPct)}%` : ""}.`}
              </div>
            </div>
          </div>

          {liveEvent && (
            <div className="fade-in-up" style={{ background: "linear-gradient(135deg,#2b1220,#1c1915)", borderRadius: "var(--rl)", padding: 18, color: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span className="live-pulse" style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, background: "var(--live)", borderRadius: 5, padding: "4px 8px" }}>● LIVE NOW</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{liveEvent.title}</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.66)", marginTop: 2 }}>{eventSub(liveEvent)}</div>
              {eventHref(liveEvent) && (
                <Link href={eventHref(liveEvent)!} style={{ display: "block", textAlign: "center", fontSize: 13, fontWeight: 700, height: 38, lineHeight: "38px", background: "#fff", color: "var(--ink)", borderRadius: "var(--rs)", marginTop: 14 }}>
                  Join class →
                </Link>
              )}
            </div>
          )}

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Today&apos;s schedule</div>
              <Link href="/student/calendar" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--orange-deep)" }}>Open</Link>
            </div>
            {todayEvents.length === 0 ? (
              <div style={{ padding: "22px 0", textAlign: "center", color: "var(--ink3)", fontSize: 13, fontWeight: 600 }}>Nothing scheduled today.</div>
            ) : (
              todayEvents.map((e) => <ScheduleRow key={e.id} event={e} />)
            )}
          </div>

          <Link href="/student/planner" style={{ display: "block", textDecoration: "none", background: "linear-gradient(140deg,#fffdf6,var(--orange-soft))", border: "1px solid #ffd0ac", borderRadius: "var(--rl)", padding: 16, color: "inherit" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--orange-deep)", marginBottom: 8 }}>Evening reflection</div>
            {todayReflection && (todayReflection.wentWell || todayReflection.toImprove) ? (
              <>
                {todayReflection.wentWell && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, lineHeight: 1.5, color: "var(--ink)" }}>
                    <span>🌱</span>
                    {todayReflection.wentWell}
                  </div>
                )}
                {todayReflection.toImprove && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, lineHeight: 1.5, color: "var(--ink)", marginTop: 6 }}>
                    <span>🎯</span>
                    {todayReflection.toImprove}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--ink2)" }}>Note what went well and what to improve today →</div>
            )}
          </Link>
        </div>
      </div>
    </main>
  );
}
