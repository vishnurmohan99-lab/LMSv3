"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { coursesApi, enrollmentsApi, ApiError, type Course, type Enrollment } from "@/lib/api";

export default function StudentCoursesPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [catalog, setCatalog] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([enrollmentsApi.mine(), coursesApi.list()])
      .then(([myEnrollments, allCourses]) => {
        setEnrollments(myEnrollments);
        setCatalog(allCourses);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load courses"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const enrolledIds = new Set(enrollments.map((e) => e.courseId));
  const browsable = catalog.filter((c) => !enrolledIds.has(c.id));

  async function onEnroll(courseId: string) {
    setEnrollingId(courseId);
    try {
      await coursesApi.enroll(courseId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to enroll");
    } finally {
      setEnrollingId(null);
    }
  }

  return (
    <main style={{ padding: 40, maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>My Courses</h1>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)", marginTop: 16 }}>Loading…</p>
      ) : (
        <>
          {enrollments.length === 0 ? (
            <p style={{ color: "var(--ink2)", marginTop: 16 }}>
              You haven&apos;t enrolled in any courses yet — browse the catalog below.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
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

          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 36 }}>Catalog</h2>
          {browsable.length === 0 ? (
            <p style={{ color: "var(--ink2)", marginTop: 12 }}>No new courses to browse right now.</p>
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {browsable.map((course) => (
                <div
                  key={course.id}
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
                  <div>
                    <span style={{ fontWeight: 700 }}>{course.title}</span>
                    {course.description && (
                      <p style={{ color: "var(--ink2)", fontSize: 13, marginTop: 6 }}>{course.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onEnroll(course.id)}
                    disabled={enrollingId === course.id}
                    style={{
                      padding: "9px 18px",
                      background: "var(--ink)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      cursor: enrollingId === course.id ? "default" : "pointer",
                      opacity: enrollingId === course.id ? 0.7 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {enrollingId === course.id ? "Enrolling…" : "Enroll"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
