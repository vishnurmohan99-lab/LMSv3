"use client";

import { useEffect, useState } from "react";
import { storiesApi, ApiError, type StoryFeedItem } from "@/lib/api";
import StoryViewer from "@/components/StoryViewer";

/**
 * The rail's "See all →" destination: the same segment-scoped feed as a grid.
 * Reuses StoryViewer so the viewing experience is identical to opening from the dashboard.
 */
export default function StudentStoriesPage() {
  const [stories, setStories] = useState<StoryFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    storiesApi
      .feed()
      .then((s) => !cancelled && setStories(s))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Failed to load stories"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = (u: StoryFeedItem) => setStories((prev) => prev.map((s) => (s.id === u.id ? { ...s, ...u } : s)));

  return (
    <main className="fade-in" style={{ padding: "30px 24px 60px", maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>Success Stories</div>
        <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 2 }}>
          Students in your segment, 20–25 seconds each.
        </div>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 14 }}>{error}</p>}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(134px, 1fr))", gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="dash-skeleton" style={{ height: 178 }} />
          ))}
        </div>
      ) : stories.length === 0 ? (
        <div style={{ maxWidth: 460, padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)" }}>
          No stories have been published for your segment yet.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(134px, 1fr))", gap: 16 }}>
          {stories.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setOpenIndex(i)}
              aria-label={`${s.studentName} — ${s.resultChip}`}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
            >
              <div
                style={{
                  position: "relative", width: "100%", aspectRatio: "134 / 178", borderRadius: 14, overflow: "hidden",
                  background: s.posterUrl ? `center/cover no-repeat url(${s.posterUrl})` : "linear-gradient(165deg,#3b332e,#1f1a17)",
                  border: s.seen ? "1px solid var(--line)" : "2px solid var(--orange)",
                  opacity: s.seen ? 0.72 : 1,
                  boxShadow: "var(--e2)",
                }}
              >
                <span style={{ position: "absolute", top: 8, left: 8, fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, background: "rgba(28,25,21,.74)", color: "#fff", borderRadius: 5, padding: "3px 6px" }}>
                  {s.resultChip}
                </span>
                {!s.seen && (
                  <span style={{ position: "absolute", top: 8, right: 8, fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: 0.7, background: "var(--orange)", color: "#fff", borderRadius: 5, padding: "2px 6px" }}>
                    NEW
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 9 }}>
                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: s.seen ? "var(--ink2)" : "var(--ink)" }}>
                  {s.studentName}
                </span>
                {s.verified && (
                  <span style={{ width: 13, height: 13, borderRadius: 999, background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, flex: "none" }}>✓</span>
                )}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                {s.seen ? "✓ " : ""}
                {s.contextLabel}
              </div>
            </button>
          ))}
        </div>
      )}

      {openIndex !== null && (
        <StoryViewer
          stories={stories}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          onStoryChange={patch}
        />
      )}
    </main>
  );
}
