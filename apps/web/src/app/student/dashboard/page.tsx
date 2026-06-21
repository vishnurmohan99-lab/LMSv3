"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { enrollmentsApi, messengerApi, ApiError, type Enrollment } from "@/lib/api";

export default function StudentDashboardPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    enrollmentsApi
      .mine()
      .then(setEnrollments)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    messengerApi.getUnreadCount().then((r) => setUnreadCount(r.count)).catch(() => {});
  }, []);

  return (
    <main style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 22 }}>Overview</div>

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--red)" }}>{error}</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginBottom: 18 }}>
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
                  background: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
                  <path d="m12 2 9 5-9 5-9-5 9-5Z" />
                  <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{enrollments.length}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: 2 }}>Enrolled courses</div>
              </div>
            </div>

            <Link
              href="/student/courses"
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
                  background: "var(--orange-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Browse catalog</div>
                <div style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: 2 }}>Find new courses to join</div>
              </div>
            </Link>

            <Link
              href="/student/messages"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rm)",
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: "var(--purple-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.8">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Messages</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: 2 }}>Chat with faculty &amp; admin</div>
                </div>
              </div>
              {unreadCount > 0 && (
                <span style={{ background: "var(--orange)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "3px 10px" }}>{unreadCount}</span>
              )}
            </Link>
          </div>

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--rl)",
              padding: 22,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Continue learning</div>

            {enrollments.length === 0 ? (
              <p style={{ color: "var(--ink2)", fontSize: 13.5 }}>
                You haven&apos;t enrolled in any courses yet.{" "}
                <Link href="/student/courses" style={{ color: "var(--orange)", fontWeight: 700 }}>
                  Browse the catalog
                </Link>
                .
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {enrollments.map(({ course }) => (
                  <Link
                    key={course.id}
                    href={`/student/courses/${course.id}`}
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
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{course.title}</div>
                      {course.description && (
                        <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>{course.description}</div>
                      )}
                    </div>
                    <span
                      style={{
                        padding: "8px 18px",
                        background: "var(--ink)",
                        color: "#fff",
                        borderRadius: 10,
                        fontSize: 12.5,
                        fontWeight: 700,
                        flex: "none",
                      }}
                    >
                      Continue
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
