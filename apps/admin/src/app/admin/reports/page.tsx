"use client";

import { useEffect, useState } from "react";
import { reportsApi, ApiError, type AdminReport, type ReportRange } from "@/lib/api";

const BAR_TRACK_HEIGHT = 120;

const RANGES: { v: ReportRange; label: string }[] = [
  { v: "RANGE_30", label: "Last 30 days" },
  { v: "QUARTER", label: "Last quarter" },
  { v: "YTD", label: "Year to date" },
  { v: "ALL", label: "All time" },
];

const RANGE_NOTE: Record<ReportRange, string> = {
  RANGE_30: "last 30 days",
  QUARTER: "last quarter",
  YTD: "year to date",
  ALL: "all time",
};

/**
 * Quote a CSV field. Excel and Sheets evaluate a cell that starts with = + - @
 * as a formula even when it is quoted, so text fields get a leading apostrophe.
 */
function csvCell(value: string | number | null) {
  if (value == null) return '""';
  if (typeof value === "number") return `"${value}"`;
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

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
  const [range, setRange] = useState<ReportRange>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bumping this refetches the current range — the retry button after a failure.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // Ranges can be switched faster than the API answers; ignore a response that
    // is no longer the one being displayed so slow requests can't overwrite fast ones.
    let cancelled = false;
    setLoading(true);
    setError(null);
    reportsApi
      .getAdminReport(range)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load reports");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, reloadKey]);

  /** Export the per-segment table as CSV — quotes fields so names with commas survive. */
  function exportCsv() {
    if (!report) return;
    const header = ["Segment", "Students", "Enrollments", "Completions", "Avg score %"];
    const rows = report.segmentBreakdown.map((r) => [r.name, r.students, r.enrollments, r.completions, r.avgScore]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${range.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    // Firefox only downloads an anchor that is in the document, and revoking the
    // URL in the same tick can cancel the download before it starts.
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const completionPct = report ? Math.round(report.batchCompletion.rate * 100) : 0;
  const rangeNote = RANGE_NOTE[range];
  const showNotes = range !== "ALL";

  return (
    <div style={{ padding: "30px 30px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 6 }}>Platform Reports</div>
          <p style={{ fontSize: 13, color: "var(--ink3)" }}>Enrollment trends, mock test performance, and batch completion across the platform.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div role="group" aria-label="Reporting range" style={{ display: "flex", gap: 4, background: "var(--bg-sunk)", borderRadius: 11, padding: 4 }}>
            {RANGES.map((r) => (
              <button
                key={r.v}
                type="button"
                aria-pressed={range === r.v}
                onClick={() => setRange(r.v)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: range === r.v ? "var(--card)" : "transparent",
                  color: range === r.v ? "var(--ink)" : "var(--ink2)",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!report}
            style={{ fontSize: 12.5, fontWeight: 600, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, height: 34, padding: "0 14px", cursor: report ? "pointer" : "not-allowed", opacity: report ? 1 : 0.5, fontFamily: "inherit" }}
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "12px 16px", marginBottom: 18 }}>
          <span style={{ color: "var(--red)", fontSize: 13 }}>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            style={{ fontSize: 12.5, fontWeight: 600, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 9, height: 30, padding: "0 12px", cursor: "pointer", fontFamily: "inherit" }}
          >
            Retry
          </button>
          {report && <span style={{ fontSize: 12.5, color: "var(--ink3)" }}>Showing the last figures that loaded.</span>}
        </div>
      )}

      {!report ? (
        <p style={{ color: "var(--ink2)", fontSize: 13 }}>{loading ? "Loading…" : "No report data."}</p>
      ) : (
      <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity .15s" }}>

      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        {/* Courses and batches are platform totals; enrollments and attempts follow the range. */}
        {([
          { label: "Total courses", value: report.totals.totalCourses, note: "all time" },
          { label: "Total batches", value: report.totals.totalBatches, note: "all time" },
          { label: "Enrollments", value: report.totals.totalEnrollments, note: rangeNote },
          { label: "Mock test attempts", value: report.totals.totalMockTestAttempts, note: rangeNote },
        ]).map((tile) => (
          <div key={tile.label} style={{ flex: "1 1 200px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "16px 18px" }}>
            <div style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 600 }}>{tile.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginTop: 4 }}>{tile.value}</div>
            {showNotes && <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>{tile.note}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginBottom: 18 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{report.trendLabel}</div>
          <BarChart data={report.enrollmentTrend} labelKey="period" valueKey="count" />
        </div>

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ marginBottom: 16, alignSelf: "flex-start" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Batch completion rate</div>
            {showNotes && <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>all time</div>}
          </div>
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

      {/* Per-segment rollup — the design's "By segment" table. */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", marginTop: 18, overflow: "hidden" }}>
        <div style={{ fontSize: 15, fontWeight: 700, padding: "20px 24px 14px" }}>By segment</div>
        {report.segmentBreakdown.length === 0 ? (
          <p style={{ color: "var(--ink3)", fontSize: 13, padding: "0 24px 22px" }}>No segments yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 560 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "10px 24px", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: "var(--ink3)", borderBottom: "1px solid var(--line)" }}>
                <span>SEGMENT</span>
                <span>STUDENTS</span>
                <span>ENROLLMENTS</span>
                <span>COMPLETIONS</span>
                <span>AVG SCORE</span>
              </div>
              {report.segmentBreakdown.map((r) => (
                <div key={r.segmentId} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", alignItems: "center", padding: "13px 24px", borderBottom: "1px solid var(--line2)", fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: r.segmentId === "__unassigned__" ? "var(--ink3)" : "var(--ink)" }}>{r.name}</span>
                  <span>{r.students}</span>
                  <span>{r.enrollments}</span>
                  <span>{r.completions}</span>
                  <span style={{ fontWeight: 700, color: r.avgScore == null ? "var(--ink3)" : r.avgScore >= 60 ? "var(--green)" : "var(--ink)" }}>
                    {r.avgScore == null ? "—" : `${r.avgScore}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
      )}
    </div>
  );
}
