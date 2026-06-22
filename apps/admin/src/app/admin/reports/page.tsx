"use client";

import { useEffect, useState } from "react";
import { reportsApi, ApiError, type AdminReport } from "@/lib/api";

const BAR_TRACK_HEIGHT = 120;

function BarChart({ data, labelKey, valueKey }: { data: Record<string, string | number>[]; labelKey: string; valueKey: string }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey])));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, padding: "0 4px" }}>
      {data.map((d, i) => {
        const value = Number(d[valueKey]);
        const barHeight = Math.max((value / max) * BAR_TRACK_HEIGHT, 3);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)" }}>{value}</div>
            <div
              style={{
                width: "100%",
                maxWidth: 48,
                height: BAR_TRACK_HEIGHT,
                display: "flex",
                alignItems: "flex-end",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: barHeight,
                  background: value > 0 ? "var(--orange)" : "var(--line)",
                  borderRadius: "8px 8px 0 0",
                  transition: "height .3s",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminReportsPage() {
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportsApi
      .getAdminReport()
      .then(setReport)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load reports"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "30px 30px 60px" }}>
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ padding: "30px 30px 60px" }}>
        <p style={{ color: "var(--red)", fontSize: 13 }}>{error ?? "Failed to load reports"}</p>
      </div>
    );
  }

  const completionPct = Math.round(report.batchCompletion.rate * 100);

  return (
    <div style={{ padding: "30px 30px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 6 }}>Platform Reports</div>
      <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 22 }}>Enrollment trends, mock test performance, and batch completion across the platform.</p>

      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          ["Total courses", report.totals.totalCourses],
          ["Total batches", report.totals.totalBatches],
          ["Total enrollments", report.totals.totalEnrollments],
          ["Mock test attempts", report.totals.totalMockTestAttempts],
        ].map(([label, value]) => (
          <div key={label} style={{ flex: "1 1 200px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "16px 18px" }}>
            <div style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginBottom: 18 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Enrollments — last 6 months</div>
          <BarChart data={report.enrollmentTrend} labelKey="period" valueKey="count" />
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, alignSelf: "flex-start" }}>Batch completion rate</div>
          <div style={{ position: "relative", width: 140, height: 140 }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="60" fill="none" stroke="var(--line)" strokeWidth="14" />
              <circle
                cx="70"
                cy="70"
                r="60"
                fill="none"
                stroke="var(--orange)"
                strokeWidth="14"
                strokeDasharray={`${(completionPct / 100) * 377} 377`}
                strokeLinecap="round"
                transform="rotate(-90 70 70)"
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>{completionPct}%</div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 14 }}>
            {report.batchCompletion.completed} of {report.batchCompletion.total} batches completed
          </div>
        </div>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Mock test score distribution</div>
        {report.totals.totalMockTestAttempts === 0 ? (
          <p style={{ color: "var(--ink3)", fontSize: 13 }}>No submitted mock test attempts yet.</p>
        ) : (
          <BarChart data={report.scoreDistribution} labelKey="bucket" valueKey="count" />
        )}
      </div>
    </div>
  );
}
