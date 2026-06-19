"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { enrollmentsApi, ApiError, type Enrollment } from "@/lib/api";

export default function StudentDashboardPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    enrollmentsApi
      .mine()
      .then(setEnrollments)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ padding: 40, maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Dashboard</h1>

      {loading ? (
        <p style={{ color: "var(--ink2)", marginTop: 16 }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--red)", marginTop: 16 }}>{error}</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
            <div style={{ flex: 1, padding: 20, background: "var(--orange-soft)", borderRadius: 14 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--orange)" }}>{enrollments.length}</div>
              <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 4 }}>Enrolled courses</div>
            </div>
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 32, marginBottom: 16 }}>Continue learning</h2>
          {enrollments.length === 0 ? (
            <p style={{ color: "var(--ink2)" }}>
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
                    display: "block",
                    padding: 18,
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderRadius: 14,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{course.title}</span>
                  {course.description && (
                    <p style={{ color: "var(--ink2)", fontSize: 13, marginTop: 6 }}>{course.description}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
