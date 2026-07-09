"use client";

import { useEffect, useState } from "react";
import { usersApi, segmentsApi, ApiError, type Profile, type Segment } from "@/lib/api";

const inputStyle: React.CSSProperties = {
  width: "100%",
  margin: "6px 0 18px",
  padding: "0 14px",
  height: 44,
  border: "1px solid var(--line)",
  borderRadius: 11,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
  boxSizing: "border-box",
};

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "··";
}

export default function ProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [subsegmentId, setSubsegmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usersApi
      .me()
      .then((p) => {
        setProfile(p);
        setFullName(p.fullName);
        setSegmentId(p.segmentId ?? "");
        setSubsegmentId(p.subsegmentId ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    segmentsApi.list().then(setSegments).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await usersApi.updateMe(
        profile?.role === "STUDENT"
          ? { fullName, segmentId: segmentId || null, subsegmentId: segmentId ? subsegmentId || null : null }
          : { fullName },
      );
      setProfile(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading…</p>;
  if (!profile) return <p style={{ color: "var(--red)" }}>{error ?? "Could not load profile"}</p>;

  const selectedSegment = segments.find((s) => s.id === segmentId);
  const requiresSubsegment = !!selectedSegment && selectedSegment.subsegments.length > 0;
  const canSave = profile.role !== "STUDENT" || !requiresSubsegment || !!subsegmentId;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4 }}>Your profile</div>
        <p style={{ color: "var(--ink3)", marginTop: 4, fontSize: 13.5 }}>Keep your details up to date so faculty can reach the right cohort.</p>
      </div>

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          padding: 32,
          marginTop: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 26 }}>
          <div style={{ width: 56, height: 56, borderRadius: 999, background: "var(--purple-soft)", color: "var(--purple-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 700, flex: "none" }}>
            {initials(fullName || profile.fullName)}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{profile.fullName}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>
              {profile.email} · <span style={{ color: "var(--orange)", fontWeight: 700 }}>{profile.role}</span>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />

          {profile.role === "STUDENT" && (
            <>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Segment / class</label>
              <select
                value={segmentId}
                onChange={(e) => {
                  setSegmentId(e.target.value);
                  setSubsegmentId("");
                }}
                style={inputStyle}
              >
                <option value="">Not set</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {selectedSegment && selectedSegment.subsegments.length > 0 && (
                <div className="pop-in">
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Stream / subsegment</label>
                  <select required value={subsegmentId} onChange={(e) => setSubsegmentId(e.target.value)} style={inputStyle}>
                    <option value="">Select…</option>
                    {selectedSegment.subsegments.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p style={{ fontSize: 12, color: "var(--ink3)", marginTop: -12, marginBottom: 18 }}>
                This determines which courses appear in your catalog.
              </p>
            </>
          )}

          {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}
          {saved && <p style={{ color: "var(--green)", fontSize: 13, marginBottom: 12 }}>Saved.</p>}

          <button
            type="submit"
            disabled={saving || !canSave}
            style={{
              width: "100%",
              height: 46,
              background: saving || !canSave ? "var(--orange-bright)" : "var(--orange)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: saving || !canSave ? "default" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
