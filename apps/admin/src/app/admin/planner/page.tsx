"use client";

import { useEffect, useMemo, useState } from "react";
import { reflectionsApi, ApiError, type Reflection } from "@/lib/api";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export default function AdminPlannerPage() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reflectionsApi
      .listAll()
      .then(setReflections)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load reflections"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => reflections.filter((r) => r.student.fullName.toLowerCase().includes(search.toLowerCase())),
    [reflections, search],
  );

  return (
    <main style={{ padding: "30px 30px 60px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 6 }}>Planner — Student Reflections</div>
      <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 22 }}>
        Daily &quot;what went well / to improve&quot; journal entries students log in their own Planner.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by student name…"
        style={{ width: "100%", maxWidth: 360, padding: "11px 16px", border: "1px solid var(--line)", borderRadius: 11, fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "var(--card)", marginBottom: 22 }}
      />

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}>
          No reflections {search ? "match that search" : "have been logged yet"}.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((r) => (
            <div key={r.id} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#f7902b,#f24d1b)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flex: "none" }}>
                  {initials(r.student.fullName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{r.student.fullName}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{r.student.email}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", flex: "none" }}>
                  {new Date(r.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </div>
              </div>
              {r.wentWell && (
                <p style={{ fontSize: 13, color: "var(--ink2)", margin: "0 0 6px" }}>
                  <span style={{ color: "var(--green)", fontWeight: 700 }}>🌱 Went well: </span>
                  {r.wentWell}
                </p>
              )}
              {r.toImprove && (
                <p style={{ fontSize: 13, color: "var(--ink2)", margin: 0 }}>
                  <span style={{ color: "var(--orange)", fontWeight: 700 }}>🎯 To improve: </span>
                  {r.toImprove}
                </p>
              )}
              {!r.wentWell && !r.toImprove && <p style={{ fontSize: 13, color: "var(--ink3)", margin: 0 }}>No notes for this entry.</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
