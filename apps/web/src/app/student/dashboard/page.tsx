"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { enrollmentsApi, testsApi, testAttemptsApi, mentorApi, calendarApi, usersApi, ApiError, type MentorBooking, type CalendarEvent, type Profile } from "@/lib/api";

interface ScoredAttempt {
  pct: number;
  submittedAt: string;
}

function PerformanceRing({ pct }: { pct: number | null }) {
  const value = pct ?? 0;
  const r = 60;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 150, height: 150, margin: "8px auto 0" }}>
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
        {pct !== null && (
          <circle
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke="var(--orange)"
            strokeWidth="14"
            strokeDasharray={`${(value / 100) * c} ${c}`}
            strokeLinecap="round"
            transform="rotate(-90 75 75)"
          />
        )}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{pct !== null ? `${Math.round(pct)}%` : "—"}</div>
        <div style={{ fontSize: 11, color: "var(--ink3)" }}>Performance</div>
      </div>
    </div>
  );
}

const BAR_TRACK_HEIGHT = 120;

function ExamScoresChart({ attempts }: { attempts: ScoredAttempt[] }) {
  const last8 = attempts.slice(-8);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: BAR_TRACK_HEIGHT }}>
      {last8.map((a, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink2)" }}>{Math.round(a.pct)}</div>
          <div
            style={{
              width: "100%",
              maxWidth: 28,
              height: Math.max((a.pct / 100) * (BAR_TRACK_HEIGHT - 20), 3),
              background: "var(--orange)",
              borderRadius: "6px 6px 0 0",
            }}
          />
        </div>
      ))}
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

function StatCard({ icon, value, label, color, soft }: { icon: React.ReactNode; value: string; label: string; color: string; soft: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: soft, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color }}>{value}</div>
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

export default function StudentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [attempts, setAttempts] = useState<ScoredAttempt[]>([]);
  const [bookings, setBookings] = useState<MentorBooking[]>([]);
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

  if (loading) {
    return (
      <main style={{ padding: "30px 30px 60px" }}>
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: "30px 30px 60px" }}>
        <p style={{ color: "var(--red)" }}>{error}</p>
      </main>
    );
  }

  const avgPct = attempts.length ? attempts.reduce((s, a) => s + a.pct, 0) / attempts.length : null;
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
    <main className="fade-in mobile-page-pad" style={{ padding: "30px 30px 60px" }}>
      {profile && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: "var(--ink3)", fontWeight: 600 }}>
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.6, marginTop: 2 }}>
            Hi, {profile.fullName.split(" ")[0]} 👋
          </div>
        </div>
      )}

      {liveNowEvents.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--red)", boxShadow: "0 0 0 4px rgba(224,83,61,.16)" }} />
              Live now
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--red)", background: "var(--red-soft)", padding: "4px 10px", borderRadius: 8 }}>
              {liveNowEvents.length} live
            </span>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {liveNowEvents.map((e) => {
              const content = (
                <div style={{ border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 14, display: "flex", gap: 13, alignItems: "center" }}>
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
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink2)" }}>Performance</div>
          </div>
          <PerformanceRing pct={avgPct} />
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)", marginTop: 6 }}>
            {avgPct === null ? "Take a mock test to see your performance." : avgPct >= 70 ? "You did a great job!" : "Keep practicing — you're getting there."}
          </div>
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22 }}>
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
          value={`${enrolledCount} Enrolled`}
          label="Courses"
          color="var(--orange)"
          soft="var(--orange-soft)"
        />

        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8">
              <path d="M9 11H3v9h6v-9ZM21 4h-6v16h6V4ZM15 9H9v11h6V9Z" />
            </svg>
          }
          value={`${attempts.length} Taken`}
          label="Mock tests"
          color="var(--blue)"
          soft="var(--blue-soft)"
        />

        <StatCard
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.8">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          }
          value={`${bookings.length} Booked`}
          label="Mentor sessions"
          color="var(--purple)"
          soft="var(--purple-soft)"
        />

        <button
          onClick={() => router.push("/student/mentor")}
          title="Book a Mentor"
          className="mentor-cta-btn"
          style={{ background: "var(--orange)", border: "none", borderRadius: "var(--rm)", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, cursor: "pointer", boxShadow: "0 4px 12px rgba(242,106,27,.32)" }}
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

      {upcomingEvents.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, marginBottom: 18 }}>
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
        <div className="mobile-stack-grid" style={{ display: "grid", gridTemplateColumns: attempts.length ? "1.3fr 1fr" : "1fr", gap: 18 }}>
          {attempts.length > 0 && (
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Exam scores</div>
              <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 16 }}>Last {Math.min(attempts.length, 8)} mock test attempts</div>
              <ExamScoresChart attempts={attempts} />
            </div>
          )}

          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, textAlign: attempts.length ? "center" : "left" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Mentorship</div>
            <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 10 }}>Sessions booked</div>
            {bookings.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink3)" }}>No mentor sessions booked yet.</p>
            ) : (
              <>
                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, margin: "8px 0" }}>{bookings.length}</div>
                <div style={{ fontSize: 12, color: "var(--ink2)", fontWeight: 600 }}>{completedSessions} completed</div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
