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
  thumbnailUrl: string | null;
  chapterLabel: string | null; // e.g. "Ch 4" — the chapter currently being studied
  nextLesson: string | null; // title of the next unviewed lesson in that chapter
  nextType: string | null; // that lesson's type (VIDEO / PDF / …) for the thumbnail glyph
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

const EVENT_ACCENT: Record<string, { bar: string; bg: string; ink: string; tag: string }> = {
  LIVE_LESSON: { bar: "var(--live)", bg: "var(--live-soft)", ink: "var(--live)", tag: "LIVE" },
  TEST: { bar: "var(--blue)", bg: "var(--blue-soft)", ink: "var(--blue)", tag: "Test" },
  CHAPTER_UNLOCK: { bar: "var(--green)", bg: "var(--green-soft)", ink: "var(--green)", tag: "Unlock" },
  MENTOR_SESSION: { bar: "var(--purple)", bg: "var(--purple-soft)", ink: "var(--purple-ink)", tag: "Session" },
};

function ScheduleRow({ event }: { event: CalendarEvent }) {
  const date = new Date(event.date);
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const href = eventHref(event);
  const a = EVENT_ACCENT[event.type] ?? EVENT_ACCENT.MENTOR_SESSION;
  const content = (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderTop: "1px solid var(--line2)" }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink3)", width: 42, flex: "none" }}>{time}</span>
      <span style={{ width: 4, height: 34, borderRadius: 2, background: a.bar, flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</div>
        <div style={{ fontSize: 10.5, color: "var(--ink3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{eventSub(event)}</div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: a.ink, background: a.bg, borderRadius: 999, padding: "3px 9px", flex: "none" }}>{a.tag}</span>
    </div>
  );
  if (href)
    return (
      <Link href={href} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
        {content}
      </Link>
    );
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

// Dummy striped thumbnail (matches the mockup) — used when a course has no real image.
const STRIPES: Record<string, string> = {
  orange: "repeating-linear-gradient(45deg,#ffe9d8,#ffe9d8 8px,#fff6ef 8px,#fff6ef 16px)",
  purple: "repeating-linear-gradient(45deg,#ece6ff,#ece6ff 8px,#f5f2ff 8px,#f5f2ff 16px)",
  green: "repeating-linear-gradient(45deg,#d7f0e6,#d7f0e6 8px,#e6f6ee 8px,#e6f6ee 16px)",
};
function initials(name?: string) {
  if (!name) return "··";
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
// Real course difficulty, set by an admin. Unrated courses show no badge.
const LEVELS: Record<string, { label: string; stripe: string; bg: string; ink: string }> = {
  EASY: { label: "Easy", stripe: "green", bg: "var(--diff-easy-soft)", ink: "var(--diff-easy)" },
  MEDIUM: { label: "Medium", stripe: "purple", bg: "var(--diff-med-soft)", ink: "var(--diff-med)" },
  HARD: { label: "Hard", stripe: "orange", bg: "var(--diff-hard-soft)", ink: "var(--diff-hard)" },
};
function levelOf(course: Course) {
  return course.difficulty ? LEVELS[course.difficulty] ?? null : null;
}

/** Enrolled-course card for "Continue learning": thumbnail + current chapter/lesson + progress. */
function ContinueCard({ prog }: { prog: CourseProgress }) {
  const isPdf = prog.nextType === "PDF";
  const sub = prog.chapterLabel && prog.nextLesson ? `${prog.chapterLabel} · ${prog.nextLesson}` : prog.pct >= 100 ? "Completed — revise anytime" : "Start your first lesson";
  return (
    <Link
      href={`/student/courses/${prog.id}`}
      className="entity-card"
      style={{ display: "flex", gap: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 16, textDecoration: "none", color: "inherit" }}
    >
      <div style={{ width: 104, height: 74, borderRadius: 12, flex: "none", position: "relative", overflow: "hidden", background: prog.thumbnailUrl ? `url(${prog.thumbnailUrl}) center/cover` : STRIPES[isPdf ? "purple" : "orange"], display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!prog.thumbnailUrl &&
          (isPdf ? (
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--purple-ink)", background: "rgba(255,255,255,.8)", borderRadius: 5, padding: "3px 7px" }}>PDF</span>
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: 999, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,.15)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--orange)"><path d="M8 5v14l11-7z" /></svg>
            </div>
          ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{prog.title}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, paddingTop: 10 }}>
          <div style={{ flex: 1, height: 6, background: "var(--line2)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${Math.round(prog.pct)}%`, height: "100%", background: "var(--progress)", borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)" }}>{Math.round(prog.pct)}%</span>
        </div>
      </div>
    </Link>
  );
}

/** Recommended-course card (badge + level + instructor + rating + price/enrolled + enroll). */
function RecCard({ course, enrolled, badge }: { course: Course; enrolled: boolean; badge: string | null }) {
  const level = levelOf(course);
  const price = fmtPrice(course);
  return (
    <Link
      href={enrolled ? `/student/courses/${course.id}` : `/student/courses?q=${encodeURIComponent(course.title)}`}
      className="entity-card"
      style={{ display: "block", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden", textDecoration: "none", color: "inherit" }}
    >
      <div style={{ height: 92, position: "relative", background: course.thumbnailUrl ? `url(${course.thumbnailUrl}) center/cover` : STRIPES[level?.stripe ?? "purple"], display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!course.thumbnailUrl && <span style={{ fontSize: 9, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--ink3)", background: "rgba(255,255,255,.75)", borderRadius: 5, padding: "3px 7px" }}>thumbnail</span>}
        {badge && (
          <span style={{ position: "absolute", top: 8, left: 8, fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: "#fff", background: badge === "BESTSELLER" ? "var(--orange)" : "var(--purple)", borderRadius: 5, padding: "3px 7px" }}>{badge}</span>
        )}
        {level && (
          <span style={{ position: "absolute", bottom: 8, left: 8, fontSize: 9.5, fontWeight: 700, color: level.ink, background: "rgba(255,255,255,.85)", borderRadius: 5, padding: "3px 7px" }}>{level.label}</span>
        )}
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.4, minHeight: 38, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{course.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, flex: "none", background: "var(--purple-soft)", color: "var(--purple-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>{initials(course.faculty?.fullName)}</div>
          <span style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.faculty?.fullName ?? "Instructor"}</span>
          {course.avgRating != null && (
            <>
              <span style={{ color: "var(--amber)", fontSize: 11 }}>★</span>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{course.avgRating.toFixed(1)}</span>
            </>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 11 }}>
          {enrolled ? (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--orange-deep)", background: "var(--orange-soft)", padding: "4px 10px", borderRadius: 999 }}>Enrolled</span>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 800, color: price === "Free" ? "var(--green)" : "var(--ink)" }}>{price}</span>
          )}
          <span style={{ fontSize: 11, fontWeight: 600, border: "1px solid var(--line)", borderRadius: 8, height: 28, display: "flex", alignItems: "center", padding: "0 12px", color: "var(--ink)" }}>{enrolled ? "Continue" : "Enroll"}</span>
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

        // Recommended shows enrolled + available-to-purchase courses (listCourses returns both
        // for a student, with faculty/rating/price included).
        coursesApi.list().then(setCatalog).catch(() => {});
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
            const enr = enrollments[i];
            if (!tree)
              return { id: enr.courseId, title: enr.course.title, total: 0, viewed: 0, pct: 0, thumbnailUrl: enr.course.thumbnailUrl, chapterLabel: null, nextLesson: null, nextType: null };
            const lessons = tree.chapters.flatMap((ch) => ch.lessons);
            const total = lessons.length;
            const viewed = lessons.filter((l) => l.viewed).length;
            // "Recently studied" chapter = first chapter that still has an unviewed lesson.
            let chapterLabel: string | null = null;
            let nextLesson: string | null = null;
            let nextType: string | null = null;
            for (let ci = 0; ci < tree.chapters.length; ci++) {
              const nl = tree.chapters[ci].lessons.find((l) => !l.viewed);
              if (nl) {
                chapterLabel = `Ch ${ci + 1}`;
                nextLesson = nl.title;
                nextType = nl.type;
                break;
              }
            }
            return { id: tree.id, title: tree.title, total, viewed, pct: total ? (viewed / total) * 100 : 0, thumbnailUrl: tree.thumbnailUrl, chapterLabel, nextLesson, nextType };
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

  // Continue learning: enrolled courses with their progress, in-progress (recently studied) first.
  const continueList = [...courseProgress]
    .sort((a, b) => {
      const rank = (p: number) => (p > 0 && p < 100 ? 0 : p === 0 ? 1 : 2);
      return rank(a.pct) - rank(b.pct) || b.pct - a.pct;
    })
    .slice(0, 4);

  // Recommended: enrolled + available-to-purchase courses. Enrolled ones hide the price.
  const enrolledIdSet = new Set(enrollments.map((e) => e.courseId));
  const topEnrollment = Math.max(0, ...catalog.map((c) => c._count?.enrollments ?? 0));
  const isNew = (c: Course) => Date.now() - new Date(c.createdAt).getTime() < 30 * 86400000;
  const recommended = [...catalog]
    .sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1) || (b._count?.enrollments ?? 0) - (a._count?.enrollments ?? 0))
    .slice(0, 6)
    .map((course) => {
      const enrolled = enrolledIdSet.has(course.id);
      // Derived preview badge (no real "bestseller" flag exists yet): most-enrolled → BESTSELLER, else recent → NEW.
      let badge: string | null = null;
      if (!enrolled && topEnrollment > 0 && (course._count?.enrollments ?? 0) === topEnrollment) badge = "BESTSELLER";
      else if (isNew(course)) badge = "NEW";
      return { course, enrolled, badge };
    });

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
                {continueList.map((prog) => (
                  <ContinueCard key={prog.id} prog={prog} />
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
                {recommended.map(({ course, enrolled, badge }) => (
                  <RecCard key={course.id} course={course} enrolled={enrolled} badge={badge} />
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
