"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { testsApi, testAttemptsApi, ApiError, type Leaderboard, type LeaderboardEntry } from "@/lib/api";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function fmtTime(seconds: number | null) {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function fmtAccuracy(acc: number | null) {
  return acc == null ? "—" : `${Math.round(acc * 100)}%`;
}

function fmtScore(e: LeaderboardEntry) {
  return e.score == null ? "—" : `${e.score}`;
}

// Gold / silver / bronze medal tints for the podium.
const MEDAL = [
  { bg: "#fdf0dd", ink: "#a35a06" },
  { bg: "#f0eef2", ink: "#6f6880" },
  { bg: "#f7ece2", ink: "#a15c2b" },
];

function PodiumCard({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const medal = MEDAL[rank - 1] ?? MEDAL[2];
  return (
    <div style={{ flex: 1, minWidth: 0, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 18, boxShadow: "var(--e1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 999, flex: "none", background: medal.bg, color: medal.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 800 }}>
          {rank}
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 999, flex: "none", background: "var(--purple-soft)", color: "var(--purple-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
          {initials(entry.studentName)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {entry.studentName}
            {entry.isMe && <span style={{ color: "var(--ink3)", fontWeight: 600 }}> · You</span>}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 11, fontWeight: 500, color: "var(--ink2)" }}>
        <span>Score</span>
        <span>Accuracy</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 800 }}>{fmtScore(entry)}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--green)" }}>{fmtAccuracy(entry.accuracy)}</span>
      </div>
    </div>
  );
}

export default function StudentLeaderboardPage() {
  const params = useParams<{ testId: string }>();
  const testId = params.testId;
  const router = useRouter();
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [testTitle, setTestTitle] = useState<string>("");
  const [scope, setScope] = useState<"all" | "batch">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([testAttemptsApi.leaderboard(testId, scope), testsApi.get(testId)])
      .then(([lb, test]) => {
        if (cancelled) return;
        setBoard(lb);
        setTestTitle(test.title);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load leaderboard");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [testId, scope]);

  const podium = board?.top.slice(0, 3) ?? [];
  // Everyone below the podium in the table; "me" is pinned separately when outside top 20.
  const tableRows = board?.top.slice(3) ?? [];
  const pinnedMe = board?.me ?? null;

  return (
    <main className="fade-in mobile-page-pad" style={{ padding: "28px 32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <button
        onClick={() => router.push(`/student/mock-test/${testId}`)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--ink2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 14 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m15 18-6-6 6-6" /></svg>
        Back to result
      </button>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.4 }}>Leaderboard</div>
          <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 3 }}>
            {testTitle}
            {board ? ` · ${board.totalRanked.toLocaleString()} ${board.totalRanked === 1 ? "attempt" : "attempts"}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", gap: 4, background: "var(--bg-sunk)", borderRadius: 11, padding: 4 }}>
            {(["all", "batch"] as const).map((s) => (
              <span
                key={s}
                onClick={() => setScope(s)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  userSelect: "none",
                  background: scope === s ? "var(--card)" : "transparent",
                  color: scope === s ? "var(--ink)" : "var(--ink2)",
                  boxShadow: scope === s ? "var(--e1)" : "none",
                }}
              >
                {s === "all" ? "All learners" : "My batch"}
              </span>
            ))}
          </div>
          {scope === "batch" && board && !board.batchAvailable && (
            <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink3)" }}>You’re not in a batch yet</span>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--ink2)", marginTop: 24 }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--red)", marginTop: 24 }}>{error}</p>
      ) : scope === "batch" && board && !board.batchAvailable ? (
        <div style={{ marginTop: 24, padding: 40, textAlign: "center", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", color: "var(--ink3)" }}>
          You’re not enrolled in a batch, so there’s no batch ranking to show. Switch to <b>All learners</b> for the full board.
        </div>
      ) : !board || board.top.length === 0 ? (
        <div style={{ marginTop: 24, padding: 40, textAlign: "center", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", color: "var(--ink3)" }}>
          {scope === "batch" ? "No one in your batch has attempted this test yet." : "No ranked attempts yet — be the first to set the bar."}
        </div>
      ) : (
        <>
          {/* Podium — top 3 */}
          <div className="lb-podium" style={{ display: "flex", gap: 16, marginTop: 22 }}>
            {podium.map((e) => (
              <PodiumCard key={e.studentId} entry={e} rank={e.rank} />
            ))}
          </div>

          {/* "You" pinned row when outside the top 20 */}
          {pinnedMe && (
            <div style={{ marginTop: 20, background: "linear-gradient(135deg,#fff6ef,#fdf0dd)", border: "1.5px solid var(--orange)", borderRadius: 16, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 800, color: "var(--orange-deep)", width: 52, flex: "none" }}>#{pinnedMe.rank}</span>
              <div style={{ width: 36, height: 36, borderRadius: 999, flex: "none", background: "var(--purple-soft)", color: "var(--purple-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                {initials(pinnedMe.studentName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>You — {pinnedMe.studentName}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink2)" }}>Your best rank on this test</div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 800, flex: "none" }}>{fmtScore(pinnedMe)}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--green)", flex: "none", width: 48, textAlign: "right" }}>{fmtAccuracy(pinnedMe.accuracy)}</span>
            </div>
          )}

          {/* Full table */}
          {tableRows.length > 0 && (
            <div className="lb-table" style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--e1)" }}>
              <div className="lb-row lb-head">
                <span>RANK</span>
                <span>LEARNER</span>
                <span>SCORE</span>
                <span>ACCURACY</span>
                <span>TIME</span>
              </div>
              {tableRows.map((r) => (
                <div key={r.studentId} className="lb-row lb-body" style={{ background: r.isMe ? "var(--orange-soft)" : "transparent" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>#{r.rank}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 999, flex: "none", background: "var(--bg-sunk)", color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                      {initials(r.studentName)}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.studentName}
                      {r.isMe && <span style={{ color: "var(--ink3)", fontWeight: 600 }}> · You</span>}
                    </div>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>{fmtScore(r)}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--green)" }}>{fmtAccuracy(r.accuracy)}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink2)" }}>{fmtTime(r.timeSeconds)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
