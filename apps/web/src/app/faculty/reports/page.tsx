"use client";

import { useEffect, useState } from "react";
import { reportsApi, ApiError, type FacultyReportCourse } from "@/lib/api";

export default function FacultyReportsPage() {
  const [courses, setCourses] = useState<FacultyReportCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    reportsApi
      .getFacultyReport()
      .then(setCourses)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load reports"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 6 }}>Reports</div>
      <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 22 }}>Student progress, mock test scores, and batch breakdown for your courses.</p>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : courses.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}>
          You don&apos;t have any courses yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {courses.map((c) => {
            const open = expanded === c.courseId;
            const avgBest = c.students.filter((s) => s.bestScorePct !== null);
            const avgScore = avgBest.length ? Math.round(avgBest.reduce((sum, s) => sum + (s.bestScorePct ?? 0), 0) / avgBest.length) : null;
            return (
              <div key={c.courseId} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden" }}>
                <button
                  onClick={() => setExpanded(open ? null : c.courseId)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{c.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 2 }}>
                      {c.enrollmentCount} enrolled · {c.mockTestCount} mock tests · {c.batches.length} batches
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flex: "none" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: avgScore !== null ? "var(--orange)" : "var(--ink3)" }}>{avgScore !== null ? `${avgScore}%` : "—"}</div>
                    <div style={{ fontSize: 11, color: "var(--ink3)" }}>avg best score</div>
                  </div>
                  <span style={{ fontSize: 13, color: "var(--ink3)", flex: "none" }}>{open ? "▲" : "▼"}</span>
                </button>

                {open && (
                  <div style={{ borderTop: "1px solid var(--line)", padding: "18px 20px" }}>
                    {c.batches.length > 0 && (
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Batches</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {c.batches.map((b) => (
                            <span key={b.id} style={{ fontSize: 12, padding: "6px 12px", background: "var(--bg)", borderRadius: 8, fontWeight: 600 }}>
                              {/* "in batch" because this counts the whole batch, not this course. */}
                              {b.name} · {b.status} · {b.batchEnrolledCount ?? b.enrolledCount ?? 0} in batch
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Students</div>
                    {c.students.length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--ink3)" }}>No students enrolled yet.</p>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                        <thead>
                          <tr style={{ textAlign: "left", color: "var(--ink2)", borderBottom: "1px solid var(--line)" }}>
                            <th style={{ padding: "8px 6px" }}>Name</th>
                            <th style={{ padding: "8px 6px" }}>Enrolled</th>
                            <th style={{ padding: "8px 6px" }}>Mock test attempts</th>
                            <th style={{ padding: "8px 6px" }}>Best score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.students.map((s) => (
                            <tr key={s.id} style={{ borderBottom: "1px solid var(--line2)" }}>
                              <td style={{ padding: "10px 6px" }}>{s.fullName}</td>
                              <td style={{ padding: "10px 6px", color: "var(--ink3)" }}>{new Date(s.enrolledAt).toLocaleDateString()}</td>
                              <td style={{ padding: "10px 6px" }}>{s.attemptCount}</td>
                              <td style={{ padding: "10px 6px", fontWeight: 700, color: s.bestScorePct !== null ? "var(--green)" : "var(--ink3)" }}>
                                {s.bestScorePct !== null ? `${Math.round(s.bestScorePct)}%` : "Not attempted"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
