"use client";

import { useEffect, useState } from "react";
import { segmentsApi, usersApi, ApiError, type Segment } from "@/lib/api";

const inputStyle: React.CSSProperties = {
  width: "100%",
  margin: "8px 0 18px",
  padding: "12px 14px",
  border: "1px solid var(--line)",
  borderRadius: "var(--rm)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
};

export default function SegmentOnboardingGate({ onDone }: { onDone: () => void }) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [subsegmentId, setSubsegmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    segmentsApi.list().then(setSegments).catch(() => {});
  }, []);

  const selectedSegment = segments.find((s) => s.id === segmentId);
  const requiresSubsegment = !!selectedSegment && selectedSegment.subsegments.length > 0;
  const canContinue = !!segmentId && (!requiresSubsegment || !!subsegmentId);

  async function onContinue() {
    if (!canContinue) return;
    setSaving(true);
    setError(null);
    try {
      await usersApi.updateMe({ segmentId, subsegmentId: requiresSubsegment ? subsegmentId : null });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 }}>
      <div className="fade-in-up" style={{ width: "100%", maxWidth: 440, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 30 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--orange)", textTransform: "uppercase" }}>One last step</div>
        <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.4, margin: "6px 0 4px" }}>Select your class</div>
        <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 22 }}>
          This determines which courses, tests and content appear for you.
        </p>

        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)" }}>Segment / Class</label>
        <select
          value={segmentId}
          onChange={(e) => {
            setSegmentId(e.target.value);
            setSubsegmentId("");
          }}
          style={inputStyle}
        >
          <option value="">Select…</option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {requiresSubsegment && (
          <>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)" }}>Subsegment / Stream</label>
            <select value={subsegmentId} onChange={(e) => setSubsegmentId(e.target.value)} style={inputStyle}>
              <option value="">Select…</option>
              {selectedSegment!.subsegments.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </>
        )}

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 14 }}>{error}</p>}

        <button
          onClick={onContinue}
          disabled={!canContinue || saving}
          style={{
            width: "100%",
            padding: 14,
            background: "var(--orange)",
            color: "#fff",
            border: "none",
            borderRadius: 13,
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: !canContinue || saving ? "default" : "pointer",
            opacity: !canContinue || saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
