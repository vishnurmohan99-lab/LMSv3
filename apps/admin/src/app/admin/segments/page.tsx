"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { segmentsApi, ApiError, type Segment } from "@/lib/api";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
};

function AddSubsegmentForm({ segmentId, onAdded }: { segmentId: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await segmentsApi.createSubsegment(segmentId, { name });
      setName("");
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add subsegment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, marginTop: 10 }}>
      <input
        required
        placeholder="New subsegment name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ ...inputStyle, flex: 1 }}
      />
      <button
        type="submit"
        disabled={busy}
        style={{
          padding: "9px 16px",
          background: "var(--ink)",
          color: "#fff",
          border: "none",
          borderRadius: 9,
          fontSize: 12.5,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Adding…" : "Add subsegment"}
      </button>
      {error && <span style={{ color: "var(--red)", fontSize: 12, alignSelf: "center" }}>{error}</span>}
    </form>
  );
}

export default function AdminSegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    segmentsApi
      .list()
      .then(setSegments)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load segments"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await segmentsApi.create({ name });
      setName("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create segment");
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteSegment(id: string) {
    try {
      await segmentsApi.remove(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete segment");
    }
  }

  async function onDeleteSubsegment(id: string) {
    try {
      await segmentsApi.removeSubsegment(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete subsegment");
    }
  }

  return (
    <div style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 22 }}>Segments</div>

      <section
        style={{
          padding: 20,
          background: "var(--card)",
          borderRadius: "var(--rl)",
          border: "1px solid var(--line)",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Create segment</div>
        <form onSubmit={onCreate} style={{ display: "flex", gap: 10 }}>
          <input
            required
            placeholder="Segment name (e.g. Competitive Exams)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="submit"
            disabled={creating}
            style={{
              padding: "10px 18px",
              background: "var(--ink)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: creating ? "default" : "pointer",
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
      </section>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : segments.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No segments yet — create one above.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {segments.map((segment) => (
            <div
              key={segment.id}
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rm)",
                padding: 18,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontWeight: 700 }}>{segment.name}</span>
                  <span style={{ fontSize: 12, color: "var(--ink2)", marginLeft: 10 }}>
                    {segment._count?.courses ?? 0} courses
                  </span>
                </div>
                <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <Link
                    href={`/admin/courses?segmentId=${segment.id}`}
                    style={{ color: "var(--orange)", fontWeight: 700, fontSize: 12 }}
                  >
                    View / add courses
                  </Link>
                  <button
                    onClick={() => onDeleteSegment(segment.id)}
                    style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 12 }}
                  >
                    Delete segment
                  </button>
                </span>
              </div>

              {segment.subsegments.length > 0 && (
                <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                  {segment.subsegments.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 10px",
                        background: "var(--bg)",
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    >
                      <span>
                        {sub.name} <span style={{ color: "var(--ink3)" }}>· {sub._count?.courses ?? 0} courses</span>
                      </span>
                      <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <Link
                          href={`/admin/courses?segmentId=${segment.id}&subsegmentId=${sub.id}`}
                          style={{ color: "var(--orange)", fontWeight: 700, fontSize: 12 }}
                        >
                          View / add courses
                        </Link>
                        <button
                          onClick={() => onDeleteSubsegment(sub.id)}
                          style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 12 }}
                        >
                          Remove
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <AddSubsegmentForm segmentId={segment.id} onAdded={load} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
