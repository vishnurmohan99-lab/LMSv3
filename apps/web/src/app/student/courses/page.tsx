"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { coursesApi, ApiError, type Course } from "@/lib/api";

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    coursesApi
      .list()
      .then(setCourses)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load courses"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ padding: 40, maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Courses</h1>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)", marginTop: 16 }}>Loading…</p>
      ) : courses.length === 0 ? (
        <p style={{ color: "var(--ink2)", marginTop: 16 }}>No courses available yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/student/courses/${c.id}`}
              style={{
                display: "block",
                padding: 18,
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 14,
              }}
            >
              <span style={{ fontWeight: 700 }}>{c.title}</span>
              {c.description && <p style={{ color: "var(--ink2)", fontSize: 13, marginTop: 6 }}>{c.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
