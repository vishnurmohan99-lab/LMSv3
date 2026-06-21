"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { coursesApi, messengerApi, usersApi, ApiError, type Course } from "@/lib/api";

function StatCard({ icon, value, label, color, soft }: { icon: React.ReactNode; value: number; label: string; color: string; soft: string }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--rm)",
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          background: soft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color }}>{value}</div>
        <div style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

export default function FacultyDashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMentor, setIsMentor] = useState(false);

  useEffect(() => {
    coursesApi
      .list()
      .then(setCourses)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    messengerApi.getUnreadCount().then((r) => setUnreadCount(r.count)).catch(() => {});
  }, []);

  useEffect(() => {
    usersApi.me().then((u) => setIsMentor(!!u.isMentor)).catch(() => {});
  }, []);

  const totalEnrollments = courses.reduce((sum, c) => sum + (c._count?.enrollments ?? 0), 0);
  const publishedCount = courses.filter((c) => c.published).length;

  return (
    <main style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 22 }}>Overview</div>

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--red)" }}>{error}</p>
      ) : (
        <>
          <Link
            href="/faculty/messages"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--rm)",
              padding: "16px 18px",
              marginBottom: 18,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: "var(--orange-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.8">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Messages</div>
                <div style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: 2 }}>Message students, admins, or broadcast announcements</div>
              </div>
            </div>
            {unreadCount > 0 && (
              <span style={{ background: "var(--orange)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "3px 10px" }}>{unreadCount}</span>
            )}
          </Link>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 18 }}>
            <StatCard
              value={courses.length}
              label="Your courses"
              color="var(--ink)"
              soft="var(--ink)"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
                  <path d="m12 2 9 5-9 5-9-5 9-5Z" />
                  <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
                </svg>
              }
            />
            <StatCard
              value={publishedCount}
              label="Published"
              color="var(--green)"
              soft="var(--green-soft)"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m8 12 3 3 5-6" />
                </svg>
              }
            />
            <StatCard
              value={totalEnrollments}
              label="Total enrollments"
              color="var(--purple)"
              soft="var(--purple-soft)"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.8">
                  <circle cx="9" cy="7" r="4" />
                  <path d="M2 21c0-4 3-6 7-6s7 2 7 6M16 11a4 4 0 0 0 0-8M22 21c0-3-2-5.5-5-6" />
                </svg>
              }
            />
          </div>

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--rl)",
              padding: 22,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Your courses</div>
              <Link href="/faculty/courses" style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
                Manage all →
              </Link>
            </div>

            {courses.length === 0 ? (
              <p style={{ color: "var(--ink2)", fontSize: 13.5 }}>
                You haven&apos;t created any courses yet.{" "}
                <Link href="/faculty/courses" style={{ color: "var(--orange)", fontWeight: 700 }}>
                  Create one
                </Link>
                .
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {courses.map((c) => (
                  <Link
                    key={c.id}
                    href={`/faculty/courses/${c.id}`}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: "var(--rm)",
                      padding: 14,
                      display: "flex",
                      gap: 13,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: "var(--orange-soft)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "none",
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.8">
                        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                        <path d="M21 12v5a2 2 0 0 1-1 1.7l-7 3.3-7-3.3A2 2 0 0 1 3 17v-5" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>
                        {c.published ? "Published" : "Draft"}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--ink2)",
                        background: "var(--bg)",
                        padding: "5px 11px",
                        borderRadius: 8,
                        flex: "none",
                      }}
                    >
                      {c._count?.enrollments ?? 0} enrolled
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--rl)",
              padding: 22,
              marginTop: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700 }}>Question Banks</div>
            <Link href="/faculty/question-banks" style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
              Manage all →
            </Link>
          </div>

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--rl)",
              padding: 22,
              marginTop: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700 }}>Tests</div>
            <Link href="/faculty/tests" style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
              Manage all →
            </Link>
          </div>

          {isMentor && (
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rl)",
                padding: 22,
                marginTop: 18,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700 }}>Mentor Availability</div>
              <Link href="/faculty/mentor" style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
                Manage slots →
              </Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}
