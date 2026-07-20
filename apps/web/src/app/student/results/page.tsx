"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { testAttemptsApi, ApiError, type MockResult, type SubjectAccuracy } from "@/lib/api";

type Range = 30 | 90 | 0; // 0 = all time

function fmtTime(seconds: number | null) {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function ordinal(n: number) {
  const r = n % 100;
  if (r >= 11 && r <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function KpiTile({ label, value, delta, sub }: { label: string; value: string; delta?: { text: string; good: boolean } | null; sub?: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--e1)" }}>
      <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--ink2)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.4 }}>{value}</span>
        {delta && (
          <span style={{ fontSize: 12, fontWeight: 700, color: delta.good ? "var(--green)" : "var(--red)" }}>{delta.text}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function pctColor(pct: number) {
  return pct >= 75 ? "var(--green)" : pct >= 50 ? "var(--amber-ink)" : "var(--red-ink)";
}

export default function StudentResultsPage() {
  const router = useRouter();
  const [attempts, setAttempts] = useState<MockResult[]>([]);
  const [subjects, setSubjects] = useState<SubjectAccuracy[]>([]);
  const [batchAvailable, setBatchAvailable] = useState(false);
  const [range, setRange] = useState<Range>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    testAttemptsApi
      .myResults()
      .then((r) => {
        if (cancelled) return;
        setAttempts(r.attempts);
        setSubjects(r.subjects);
        setBatchAvailable(r.batchAvailable);
      })
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Failed to load results"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const inRange = useMemo(() => {
    if (range === 0) return attempts;
    const cutoff = Date.now() - range * 24 * 60 * 60 * 1000;
    return attempts.filter((a) => a.submittedAt && new Date(a.submittedAt).getTime() >= cutoff);
  }, [attempts, range]);

  const kpis = useMemo(() => {
    const withPct = inRange.filter((a) => a.percentile != null);
    const withAcc = inRange.filter((a) => a.accuracy != null);
    const avgPct = withPct.length ? Math.round(withPct.reduce((s, a) => s + (a.percentile ?? 0), 0) / withPct.length) : null;
    const avgAcc = withAcc.length ? Math.round((withAcc.reduce((s, a) => s + (a.accuracy ?? 0), 0) / withAcc.length) * 100) : null;
    const best = inRange.reduce<MockResult | null>((b, a) => (!b || a.scorePct > b.scorePct ? a : b), null);
    // First→latest percentile movement, for the trend delta.
    const firstP = withPct[0]?.percentile ?? null;
    const lastP = withPct[withPct.length - 1]?.percentile ?? null;
    const pctDelta = firstP != null && lastP != null ? lastP - firstP : null;
    return { avgPct, avgAcc, best, lastP, pctDelta };
  }, [inRange]);

  // Only show up to the most recent ~14 attempts in the trend so bars stay legible.
  const trend = inRange.slice(-14);
  const recent = [...inRange].reverse().slice(0, 8);
  const weakest = subjects[0] ?? null;

  return (
    <main className="fade-in mobile-page-pad" style={{ padding: "28px 32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>Your performance</div>
          <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 3 }}>
            {loading ? "Loading…" : `Across ${attempts.length} mock ${attempts.length === 1 ? "attempt" : "attempts"}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-sunk)", borderRadius: 11, padding: 4 }}>
          {([30, 90, 0] as Range[]).map((r) => (
            <span
              key={r}
              onClick={() => setRange(r)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 14px",
                borderRadius: 8,
                cursor: "pointer",
                userSelect: "none",
                background: range === r ? "var(--card)" : "transparent",
                color: range === r ? "var(--ink)" : "var(--ink2)",
                boxShadow: range === r ? "var(--e1)" : "none",
              }}
            >
              {r === 0 ? "All time" : `${r} days`}
            </span>
          ))}
        </div>
      </div>

      {error ? (
        <p style={{ color: "var(--red)" }}>{error}</p>
      ) : loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : attempts.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink2)" }}>No attempts yet</div>
          <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 6 }}>Take a mock test and your performance trend will build here.</div>
          <button onClick={() => router.push("/student/mock-test")} style={{ marginTop: 16, background: "var(--orange)", color: "#fff", border: "none", borderRadius: 10, height: 40, padding: "0 20px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            Browse mock tests
          </button>
        </div>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="ra-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
            <KpiTile label="Tests taken" value={`${inRange.length}`} sub={range === 0 ? "all time" : `last ${range} days`} />
            <KpiTile
              label="Avg percentile"
              value={kpis.avgPct != null ? ordinal(kpis.avgPct) : "—"}
              delta={kpis.pctDelta != null && kpis.pctDelta !== 0 ? { text: `${kpis.pctDelta > 0 ? "▲" : "▼"} ${Math.abs(kpis.pctDelta)}`, good: kpis.pctDelta > 0 } : null}
              sub={kpis.lastP != null ? `latest ${ordinal(kpis.lastP)}` : undefined}
            />
            <KpiTile label="Best score" value={kpis.best ? `${kpis.best.scorePct}%` : "—"} sub={kpis.best?.testTitle} />
            <KpiTile label="Avg accuracy" value={kpis.avgAcc != null ? `${kpis.avgAcc}%` : "—"} sub={`across ${inRange.length} ${inRange.length === 1 ? "test" : "tests"}`} />
          </div>

          <div className="ra-main" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>
            {/* Percentile trend */}
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px 22px", boxShadow: "var(--e1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Percentile trend</div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--ink2)", alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--orange)" }} />Your score
                  </span>
                  {batchAvailable && (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--line)" }} />Batch median
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 180, padding: "0 4px" }}>
                {trend.map((a) => {
                  const h = a.percentile ?? 0;
                  const bm = a.batchMedianPercentile;
                  const tip = `${a.testTitle} · you ${a.percentile != null ? ordinal(a.percentile) : "—"}${bm != null ? ` · batch median ${ordinal(bm)}` : ""}`;
                  return (
                    <div key={a.attemptId} title={tip} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end", minWidth: 0 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink2)" }}>{a.percentile ?? "—"}</span>
                      {/* Your bar + the batch-median bar side by side, per the design. */}
                      <div style={{ width: "100%", display: "flex", gap: 3, alignItems: "flex-end", justifyContent: "center", height: "100%" }}>
                        <div className="ra-bar" style={{ flex: 1, maxWidth: 22, height: `${Math.max(4, h)}%`, background: "var(--orange)", borderRadius: "5px 5px 0 0", transition: "height .3s ease" }} />
                        {batchAvailable && bm != null && (
                          <div className="ra-bar" style={{ flex: 1, maxWidth: 22, height: `${Math.max(4, bm)}%`, background: "var(--line)", borderRadius: "5px 5px 0 0", transition: "height .3s ease" }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {kpis.pctDelta != null && kpis.pctDelta !== 0 && (
                <div style={{ borderTop: "1px solid var(--line2)", marginTop: 14, paddingTop: 12, fontSize: 12, lineHeight: 1.5, color: "var(--ink2)" }}>
                  📈 Your percentile moved{" "}
                  <b style={{ color: kpis.pctDelta > 0 ? "var(--green)" : "var(--red)" }}>
                    {kpis.pctDelta > 0 ? "+" : ""}{kpis.pctDelta}
                  </b>{" "}
                  from your first to your latest attempt in this range.
                </div>
              )}
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px", boxShadow: "var(--e1)" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Accuracy by subject</div>
                {subjects.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>No tagged questions in your attempts yet.</div>
                ) : (
                  subjects.map((s) => (
                    <div key={s.name} style={{ padding: "7px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                        <span>{s.name}</span>
                        <span style={{ color: pctColor(s.pct) }}>{s.pct}%</span>
                      </div>
                      <div style={{ height: 7, background: "var(--line2)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${s.pct}%`, height: "100%", background: pctColor(s.pct), borderRadius: 999 }} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {weakest && (
                <div style={{ background: "var(--purple-soft)", border: "1px solid #ddd2ff", borderRadius: 14, padding: "16px 18px" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--purple-ink)", marginBottom: 6 }}>◆ Focus recommendation</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "#403b35" }}>
                    Your weakest area is <b>{weakest.name}</b> at {weakest.pct}% accuracy ({weakest.correct}/{weakest.total} correct). A focused practice set here should move your score the most.
                  </div>
                  <button onClick={() => router.push("/student/workout")} style={{ fontSize: 12, fontWeight: 600, background: "var(--purple)", color: "#fff", border: "none", borderRadius: 9, height: 32, padding: "0 14px", marginTop: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    Practice now →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Recent attempts */}
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, marginTop: 20, boxShadow: "var(--e1)", overflow: "hidden" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line2)", fontSize: 15, fontWeight: 700 }}>Recent attempts</div>
            <div className="ra-table">
              <div className="ra-row ra-head">
                <span>TEST</span>
                <span>SCORE</span>
                <span>PERCENTILE</span>
                <span>ACCURACY</span>
                <span>TIME USED</span>
                <span />
              </div>
              {recent.map((a) => (
                <div key={a.attemptId} className="ra-row ra-body">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.testTitle}</div>
                    <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 1 }}>{fmtDate(a.submittedAt)}</div>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>{a.score}/{a.maxScore}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700, color: a.percentile != null ? pctColor(a.percentile) : "var(--ink3)" }}>
                    {a.percentile != null ? ordinal(a.percentile) : "—"}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink2)" }}>{a.accuracy != null ? `${Math.round(a.accuracy * 100)}%` : "—"}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink2)" }}>{fmtTime(a.timeSeconds)}</span>
                  <button
                    onClick={() => router.push(`/student/mock-test/${a.testId}`)}
                    style={{ fontSize: 11.5, fontWeight: 600, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, height: 30, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
