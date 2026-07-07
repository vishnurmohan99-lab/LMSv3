"use client";

import { useEffect, useState } from "react";
import { facultyNotesApi, ApiError, type StudentNotes } from "@/lib/api";

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "1px solid var(--line)",
  borderRadius: "var(--rs)",
  fontSize: 13.5,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.8">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

export default function StudentNotesPage() {
  const [data, setData] = useState<StudentNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [courseId, setCourseId] = useState("");
  const [chapterId, setChapterId] = useState("");

  useEffect(() => {
    facultyNotesApi
      .mine()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load notes"))
      .finally(() => setLoading(false));
  }, []);

  const chapterOptions = (data?.chapters ?? []).filter((c) => !courseId || c.courseId === courseId);
  const notes = (data?.notes ?? []).filter(
    (n) =>
      (!q || n.name.toLowerCase().includes(q.toLowerCase())) &&
      (!courseId || n.courseId === courseId) &&
      (!chapterId || n.chapterId === chapterId),
  );

  return (
    <main className="fade-in mobile-page-pad" style={{ padding: "30px 30px 60px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.7, marginBottom: 4 }}>Faculty Notes</div>
      <div style={{ fontSize: 13, color: "var(--ink3)", fontWeight: 600, marginBottom: 22 }}>Study notes shared by your faculty across your batches.</div>

      {/* Search + filters */}
      <div className="mobile-stack-header" style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 300px", maxWidth: 420 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes by name…" style={{ ...inputStyle, width: "100%", padding: "10px 40px 10px 14px", borderRadius: 999 }} />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="2" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setChapterId("");
          }}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="">All courses</option>
          {(data?.courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} disabled={chapterOptions.length === 0} style={{ ...inputStyle, cursor: "pointer", opacity: chapterOptions.length === 0 ? 0.5 : 1 }}>
          <option value="">All chapters</option>
          {chapterOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <div style={{ display: "grid", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="dash-skeleton" style={{ height: 72 }} />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--ink3)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>{data && data.notes.length > 0 ? "No notes match your filters" : "No notes shared yet"}</div>
          <div style={{ fontSize: 13 }}>{data && data.notes.length > 0 ? "Try clearing the search or filters." : "Your faculty hasn't shared any notes for your batches yet."}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {notes.map((n) => (
            <a
              key={n.id}
              href={n.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="entity-card"
              style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: "14px 18px", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, flex: "none", background: "var(--orange-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileIcon />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "var(--purple-ink)", background: "var(--purple-soft)", padding: "2px 8px", borderRadius: 999 }}>{n.course.title}</span>
                  {n.chapter && <span style={{ fontWeight: 600, color: "var(--ink2)", background: "var(--bg-sunk)", padding: "2px 8px", borderRadius: 999 }}>{n.chapter.title}</span>}
                </div>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#fff", background: "var(--ink)", padding: "8px 16px", borderRadius: 999, flex: "none" }}>
                Open
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </span>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
