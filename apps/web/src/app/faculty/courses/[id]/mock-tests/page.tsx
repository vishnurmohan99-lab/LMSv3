"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { testsApi, coursesApi, ApiError, type Test, type Course } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 18px",
  background: "var(--ink)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
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

function AttachTestPanel({ courseId, onAttached }: { courseId: string; onAttached: () => void }) {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    testsApi
      .list()
      .then((all) => setTests(all.filter((t) => !t.chapterId && !t.courseId)))
      .catch(() => setError("Failed to load tests"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tests.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()));

  async function onAttach(testId: string) {
    setAttachingId(testId);
    setError(null);
    try {
      await testsApi.update(testId, { courseId });
      onAttached();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to attach test");
    } finally {
      setAttachingId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10, marginBottom: 22, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16 }}>
      <input placeholder="Search tests…" value={query} onChange={(e) => setQuery(e.target.value)} style={inputStyle} />
      {loading ? (
        <p style={{ color: "var(--ink2)", fontSize: 13 }}>Loading tests…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--ink2)", fontSize: 13 }}>No unattached tests found. Create one instead, or detach it from its current chapter/course first.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
          {filtered.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg)", borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                  {t._count?.testQuestions ?? 0} question{(t._count?.testQuestions ?? 0) === 1 ? "" : "s"} · {t.published ? "Published" : "Draft"}
                </div>
              </div>
              <button
                onClick={() => onAttach(t.id)}
                disabled={attachingId === t.id}
                style={{ ...btnStyle, background: "var(--card)", color: "var(--ink2)", border: "1px solid var(--line)", opacity: attachingId === t.id ? 0.6 : 1 }}
              >
                {attachingId === t.id ? "Attaching…" : "Attach"}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
    </div>
  );
}

export default function FacultyMockTestsPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const confirm = useConfirm();

  const [course, setCourse] = useState<Course | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showAttachForm, setShowAttachForm] = useState(false);
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

  async function onDetach(e: React.MouseEvent, testId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!(await confirm({ message: "Remove this test from the course? The test itself won't be deleted." }))) return;
    await testsApi.update(testId, { courseId: null });
    load();
  }

  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--orange)", textTransform: "uppercase", marginBottom: 4 }}>
        {course ? course.title : "Course"}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Mock Tests</div>
        <span style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setShowAttachForm((s) => !s)}
            style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)" }}
          >
            {showAttachForm ? "Close" : "+ Attach existing test"}
          </button>
          <button onClick={() => setShowAddForm((s) => !s)} style={btnStyle}>
            {showAddForm ? "Close" : "+ Add mock test"}
          </button>
        </span>
      </div>

      {showAttachForm && (
        <AttachTestPanel
          courseId={courseId}
          onAttached={() => {
            setShowAttachForm(false);
            load();
          }}
        />
      )}

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
        <p style={{ color: "var(--ink2)" }}>No mock tests yet for this course. Create or attach your first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {tests.map((test) => (
            <Link
              key={test.id}
              href={`/faculty/courses/${courseId}/mock-tests/${test.id}`}
              className="entity-card"
              style={{ display: "block", position: "relative", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden" }}
            >
              <button
                onClick={(e) => onDetach(e, test.id)}
                title="Remove from course"
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  zIndex: 2,
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: "rgba(0,0,0,.35)",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                </svg>
              </button>
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
