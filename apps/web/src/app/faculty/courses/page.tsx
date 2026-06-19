"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { coursesApi, ApiError, type Course } from "@/lib/api";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

export default function FacultyCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    coursesApi
      .list()
      .then(setCourses)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load courses"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await coursesApi.create({ title });
      setTitle("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create course");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main style={{ padding: 40, maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>My Courses</h1>

      <form onSubmit={onCreate} style={{ display: "flex", gap: 10, marginTop: 24, marginBottom: 24 }}>
        <input
          required
          placeholder="New course title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="submit"
          disabled={creating}
          style={{
            padding: "10px 18px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: creating ? "default" : "pointer",
            opacity: creating ? 0.7 : 1,
          }}
        >
          {creating ? "Creating…" : "Create course"}
        </button>
      </form>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : courses.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No courses yet. Create your first one above.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/faculty/courses/${c.id}`}
              style={{
                display: "block",
                padding: 18,
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>{c.title}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: c.published ? "var(--green-soft)" : "var(--amber-soft)",
                    color: c.published ? "var(--green)" : "var(--amber)",
                  }}
                >
                  {c.published ? "Published" : "Draft"}
                </span>
              </div>
              {c.description && <p style={{ color: "var(--ink2)", fontSize: 13, marginTop: 6 }}>{c.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
