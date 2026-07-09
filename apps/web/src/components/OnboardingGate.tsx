"use client";

import { useEffect, useState } from "react";
import { usersApi, segmentsApi, ApiError, type Profile, type Segment } from "@/lib/api";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

/**
 * Forces a class-less student to pick their segment (+ subsegment, if the segment has any)
 * before the app becomes usable — the backend scopes every course list to the student's
 * profile segment, so without one the catalog is empty. Renders full-screen (bypassing the
 * shell) until a segment is saved, then reveals the wrapped app.
 */
export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [needsGate, setNeedsGate] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);

  const [step, setStep] = useState<1 | 2>(1);
  const [segmentId, setSegmentId] = useState("");
  const [subsegmentId, setSubsegmentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([usersApi.me(), segmentsApi.list().catch(() => [])])
      .then(([me, segs]) => {
        if (cancelled) return;
        setSegments(segs);
        setNeedsGate((me as Profile).role === "STUDENT" && !(me as Profile).segmentId);
      })
      .catch(() => {
        // If we can't resolve the profile, let AuthGuard handle the redirect — don't gate.
        if (!cancelled) setNeedsGate(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div style={{ padding: 40, color: "var(--ink2)" }}>Loading…</div>;
  if (!needsGate) return <>{children}</>;

  const selectedSegment = segments.find((s) => s.id === segmentId) ?? null;
  const hasTracks = !!selectedSegment && selectedSegment.subsegments.length > 0;
  const onStep2 = step === 2;
  const tiles = onStep2 ? (selectedSegment?.subsegments ?? []) : segments;
  const selectedId = onStep2 ? subsegmentId : segmentId;
  const canContinue = onStep2 ? !!subsegmentId : !!segmentId;
  const isFinal = onStep2 || !hasTracks;

  async function onContinue() {
    if (!canContinue) return;
    if (!isFinal) {
      setStep(2);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await usersApi.updateMe({ segmentId, subsegmentId: hasTracks ? subsegmentId : null });
      // Reload so every downstream fetch (catalog, dashboard) re-scopes to the new segment.
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg,#fff6ef 0%,#faf8f6 55%,#f5f2ff 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 28, left: 32, display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: 9, background: "var(--orange)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 0, height: 0, borderLeft: "7px solid #fff", borderTop: "5px solid transparent", borderBottom: "5px solid transparent", marginLeft: 2, transform: "rotate(-90deg)" }} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 800 }}>Elearning</span>
      </div>

      <div
        className="fade-in-up"
        style={{ width: 620, maxWidth: "100%", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 24, padding: "36px 40px", boxShadow: "0 8px 24px rgba(28,22,15,.10)", boxSizing: "border-box" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, fontFamily: "var(--font-mono)", color: "var(--orange-deep)" }}>
            STEP {onStep2 ? 2 : 1} OF {hasTracks ? 2 : 1}
          </span>
          <div style={{ display: "flex", gap: 5 }}>
            <span style={{ width: 22, height: 5, borderRadius: 3, background: "var(--orange)" }} />
            {hasTracks && <span style={{ width: 22, height: 5, borderRadius: 3, background: onStep2 ? "var(--orange)" : "var(--line)" }} />}
          </div>
        </div>

        <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.4 }}>
          {onStep2 ? "Choose your track" : "What are you preparing for?"}
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink3)", marginTop: 6 }}>
          {onStep2
            ? `${selectedSegment?.name} has a few tracks — pick the one you're preparing for.`
            : "Pick your class so we can scope your courses, tests and mentors to the right syllabus."}
        </div>

        {tiles.length === 0 ? (
          <div style={{ marginTop: 22, padding: 20, border: "1px dashed var(--line)", borderRadius: 16, color: "var(--ink3)", fontSize: 13.5 }}>
            No classes have been set up yet. Please check back shortly.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 22 }}>
            {tiles.map((t) => {
              const on = selectedId === t.id;
              const trackCount = !onStep2 ? (segments.find((s) => s.id === t.id)?.subsegments.length ?? 0) : 0;
              return (
                <button
                  key={t.id}
                  onClick={() => (onStep2 ? setSubsegmentId(t.id) : (setSegmentId(t.id), setSubsegmentId("")))}
                  style={{
                    position: "relative",
                    textAlign: "center",
                    border: on ? "2px solid var(--orange)" : "1.5px solid var(--line)",
                    background: on ? "var(--orange-soft)" : "var(--card)",
                    borderRadius: 20,
                    padding: "20px 16px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {on && (
                    <span style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: "50%", background: "var(--orange)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                      ✓
                    </span>
                  )}
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: on ? "var(--orange)" : "var(--purple-soft)", color: on ? "#fff" : "var(--purple-ink)", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>
                    {initials(t.name)}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                  {!onStep2 && (
                    <div style={{ fontSize: 11, lineHeight: 1.5, color: "var(--ink3)", marginTop: 3 }}>
                      {trackCount > 0 ? `${trackCount} track${trackCount === 1 ? "" : "s"}` : "All courses"}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 16 }}>{error}</p>}

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 26 }}>
          <span style={{ fontSize: 12, color: "var(--ink3)" }}>🔒 Required to personalize your syllabus — change it later in Profile.</span>
          <div style={{ flex: 1 }} />
          {onStep2 && (
            <button
              onClick={() => setStep(1)}
              style={{ fontSize: 14, fontWeight: 600, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, height: 44, padding: "0 18px", cursor: "pointer", fontFamily: "inherit" }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={onContinue}
            disabled={!canContinue || saving}
            style={{
              fontSize: 15,
              fontWeight: 600,
              background: !canContinue || saving ? "var(--orange-bright)" : "var(--orange)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              height: 44,
              padding: "0 24px",
              cursor: !canContinue || saving ? "default" : "pointer",
              fontFamily: "inherit",
              boxShadow: "0 2px 8px rgba(242,106,27,.3)",
            }}
          >
            {saving ? "Saving…" : isFinal ? "Get started →" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
