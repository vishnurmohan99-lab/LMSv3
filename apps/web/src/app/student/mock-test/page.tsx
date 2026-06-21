"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { enrollmentsApi, testsApi, testAttemptsApi, ApiError, type Test } from "@/lib/api";

interface MockTestRow {
  test: Test;
  courseTitle: string;
  bestScore: number | null;
  maxScore: number | null;
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export default function StudentMockTestListPage() {
  const [rows, setRows] = useState<MockTestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    enrollmentsApi
      .mine()
      .then(async (enrollments) => {
        const perCourse = await Promise.all(
          enrollments.map(async (e) => {
            const tests = await testsApi.list({ courseId: e.courseId });
            return tests.filter((t) => t.published).map((t) => ({ test: t, courseTitle: e.course.title }));
          }),
        );
        const flat = perCourse.flat();
        const withScores = await Promise.all(
          flat.map(async ({ test, courseTitle }) => {
            const attempts = await testAttemptsApi.mine(test.id).catch(() => []);
            const submitted = attempts.filter((a) => a.status === "SUBMITTED" && a.score !== null);
            const best = submitted.reduce<typeof submitted[number] | null>((acc, a) => (!acc || (a.score ?? 0) > (acc.score ?? 0) ? a : acc), null);
            return { test, courseTitle, bestScore: best?.score ?? null, maxScore: best?.maxScore ?? null };
          }),
        );
        setRows(withScores);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load mock tests"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="fade-in" style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 22 }}>Mock Tests</div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No mock tests are available for your enrolled courses yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {rows.map(({ test, courseTitle, bestScore, maxScore }, i) => (
            <Link
              key={test.id}
              href={`/student/mock-test/${test.id}`}
              className="entity-card fade-in-up"
              style={{
                display: "block",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rl)",
                overflow: "hidden",
                animationDelay: `${i * 40}ms`,
              }}
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
                  <div className="banner-gradient-orange" style={{ width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}>
                    {initials(test.title)}
                  </div>
                </div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", marginBottom: 4 }}>{courseTitle}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{test.title}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: "var(--purple-soft)", color: "var(--purple)" }}>
                    {test.publishMode === "TIMED" ? "Timed" : "Untimed"}
                  </span>
                  {bestScore !== null ? (
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--green)" }}>
                      Best: {bestScore}/{maxScore}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12.5, color: "var(--ink3)" }}>Not attempted</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
