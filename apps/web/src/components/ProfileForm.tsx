"use client";

import { useEffect, useState } from "react";
import { usersApi, ApiError, type Profile } from "@/lib/api";

const inputStyle: React.CSSProperties = {
  width: "100%",
  margin: "8px 0 16px",
  padding: "12px 14px",
  border: "1px solid var(--line)",
  borderRadius: "var(--rm)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
};

export default function ProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
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
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({ fullName });
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

  return (
    <div
      style={{
        maxWidth: 420,
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--rl)",
        padding: 24,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Profile</div>
      <p style={{ color: "var(--ink2)", marginTop: 6, marginBottom: 20, fontSize: 13.5 }}>
        {profile.email} ·{" "}
        <span style={{ color: "var(--orange)", fontWeight: 700 }}>{profile.role}</span>
      </p>

      <form onSubmit={onSubmit}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)" }}>Full name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{error}</p>}
        {saved && <p style={{ color: "var(--green)", fontSize: 13, marginBottom: 10 }}>Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "11px 20px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
