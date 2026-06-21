"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { testsApi, coursesApi, ApiError, type Test, type Course } from "@/lib/api";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 7,
        background: published ? "var(--green-soft)" : "var(--amber-soft)",
        color: published ? "var(--green)" : "var(--amber)",
      }}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

export default function FacultyMockTestsPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const [course, setCourse] = useState<Course | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([coursesApi.get(courseId), testsApi.list({ courseId })])
      .then(([c, t]) => {
        setCourse(c);
        setTests(t);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load mock tests"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [courseId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await testsApi.create({ title, courseId });
      setTitle("");
      setShowAddForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create mock test");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--orange)", textTransform: "uppercase", marginBottom: 4 }}>
        {course ? course.title : "Course"}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Mock Tests</div>
        <button
          onClick={() => setShowAddForm((s) => !s)}
          style={{
            padding: "10px 18px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {showAddForm ? "Close" : "+ Add mock test"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={onCreate}
          style={{ display: "grid", gap: 10, marginBottom: 22, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16 }}
        >
          <input required autoFocus placeholder="Mock test title" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
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
              justifySelf: "start",
            }}
          >
            {creating ? "Creating…" : "Create mock test"}
          </button>
        </form>
      )}

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : tests.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No mock tests yet for this course. Create your first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {tests.map((test) => (
            <Link
              key={test.id}
              href={`/faculty/courses/${courseId}/mock-tests/${test.id}`}
              className="entity-card"
              style={{ display: "block", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden" }}
            >
              <div className="banner-gradient-dark" style={{ position: "relative", height: 110, overflow: "hidden" }}>
                <div
                  style={{
                    position: "absolute",
                    right: -30,
                    bottom: -30,
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(242,106,27,.35), transparent 70%)",
                  }}
                />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div
                    className="banner-gradient-orange"
                    style={{ width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}
                  >
                    {initials(test.title)}
                  </div>
                </div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{test.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <StatusBadge published={test.published} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: "var(--purple-soft)", color: "var(--purple)" }}>
                    {test.publishMode === "TIMED" ? "Timed" : "Manual"}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--ink2)" }}>
                    {test._count?.testQuestions ?? 0} question{test._count?.testQuestions === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
