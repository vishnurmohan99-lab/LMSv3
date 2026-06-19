"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { coursesApi, ApiError, type Course } from "@/lib/api";

export default function FacultyDashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    coursesApi
      .list()
      .then(setCourses)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const totalEnrollments = courses.reduce((sum, c) => sum + (c._count?.enrollments ?? 0), 0);
  const publishedCount = courses.filter((c) => c.published).length;

  return (
    <main style={{ padding: 40, maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Faculty Dashboard</h1>

      {loading ? (
        <p style={{ color: "var(--ink2)", marginTop: 16 }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--red)", marginTop: 16 }}>{error}</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
            <div style={{ flex: 1, padding: 20, background: "var(--orange-soft)", borderRadius: 14 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--orange)" }}>{courses.length}</div>
              <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 4 }}>Your courses</div>
            </div>
            <div style={{ flex: 1, padding: 20, background: "var(--green-soft)", borderRadius: 14 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--green)" }}>{publishedCount}</div>
              <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 4 }}>Published</div>
            </div>
            <div style={{ flex: 1, padding: 20, background: "var(--purple-soft)", borderRadius: 14 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--purple)" }}>{totalEnrollments}</div>
              <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 4 }}>Total enrollments</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Your courses</h2>
            <Link href="/faculty/courses" style={{ color: "var(--orange)", fontWeight: 700, fontSize: 14 }}>
              Manage all →
            </Link>
          </div>

          {courses.length === 0 ? (
            <p style={{ color: "var(--ink2)" }}>
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
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 18,
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderRadius: 14,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{c.title}</span>
                  <span style={{ fontSize: 13, color: "var(--ink2)" }}>
                    {c._count?.enrollments ?? 0} enrolled
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
