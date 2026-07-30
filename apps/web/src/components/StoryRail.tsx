"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { storiesApi, type StoryFeedItem } from "@/lib/api";
import StoryViewer from "./StoryViewer";

/**
 * Success Stories rail — ported from Design System/Student - Stories.dc.html
 * ("Dashboard with Story Rail" + the result-card component sheet).
 *
 * Deliberately NOT Instagram rings: each card is a portrait result card carrying the
 * student's actual number, because the design forbids a card without one. Unwatched cards
 * take a 2px orange keyline and a NEW chip; watched cards dim, get a ✓ and sort last.
 *
 * The rail hides itself entirely when the scoped feed is empty — there is no empty state —
 * and it must only ever be mounted on the dashboard, never inside a lesson or quiz shell.
 */

const HOVER_PREVIEW_MS = 400;

/** Card geometry from the mockup: 134 wide, height = round(w * 1.328). */
function ResultCard({
  story,
  width,
  onOpen,
}: {
  story: StoryFeedItem;
  width: number;
  onOpen: () => void;
}) {
  const height = Math.round(width * 1.328);
  const [previewing, setPreviewing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const big = width > 120;

  // Hover ≥400ms starts a muted in-place preview. There is no separate low-bitrate preview
  // rendition (no transcoding pipeline), so this reuses the clip — fine at 20–25s.
  function enter() {
    if (!story.videoUrl) return;
    timer.current = setTimeout(() => setPreviewing(true), HOVER_PREVIEW_MS);
  }
  function leave() {
    if (timer.current) clearTimeout(timer.current);
    setPreviewing(false);
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (previewing) {
      v.currentTime = 0;
      v.play().catch(() => setPreviewing(false));
    } else {
      v.pause();
    }
  }, [previewing]);

  return (
    <button
      onClick={onOpen}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
      aria-label={`${story.studentName} — ${story.resultChip}${story.seen ? ", watched" : ", new"}`}
      style={{ width, flex: "none", cursor: "pointer", background: "none", border: "none", padding: 0, textAlign: "left", fontFamily: "inherit" }}
    >
      <div
        style={{
          position: "relative",
          width,
          height,
          borderRadius: 14,
          overflow: "hidden",
          boxSizing: "border-box",
          background: story.posterUrl
            ? `center/cover no-repeat url(${story.posterUrl})`
            : "linear-gradient(165deg,#3b332e,#1f1a17)",
          transition: "all .18s",
          border: story.seen ? "1px solid var(--line)" : "2px solid var(--orange)",
          opacity: story.seen ? 0.72 : 1,
          boxShadow: previewing ? "0 10px 26px rgba(28,22,15,.20)" : "var(--e2)",
          transform: previewing ? "translateY(-2px)" : "none",
        }}
      >
        {previewing && story.videoUrl && (
          <video
            ref={videoRef}
            src={story.videoUrl}
            muted
            loop
            playsInline
            preload="metadata"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        <span
          style={{
            position: "absolute", top: 8, left: 8, fontFamily: "var(--font-mono)",
            fontSize: big ? 8.5 : 7.5, fontWeight: 700, letterSpacing: 0.5,
            background: "rgba(28,25,21,.74)", color: "#fff", borderRadius: 5, padding: "3px 6px",
          }}
        >
          {story.resultChip}
        </span>

        {!story.seen && (
          <span
            style={{
              position: "absolute", top: 8, right: 8, fontFamily: "var(--font-mono)", fontSize: 8.5,
              fontWeight: 700, letterSpacing: 0.7, background: "var(--orange)", color: "#fff",
              borderRadius: 5, padding: "2px 6px",
            }}
          >
            NEW
          </span>
        )}

        {previewing ? (
          <>
            <span
              style={{
                position: "absolute", bottom: 12, left: 8, fontFamily: "var(--font-mono)", fontSize: 8,
                fontWeight: 700, letterSpacing: 0.5, background: "rgba(28,25,21,.76)",
                color: "var(--orange-bright)", borderRadius: 4, padding: "3px 6px",
              }}
            >
              MUTED
            </span>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "rgba(255,255,255,.24)" }}>
              <div style={{ width: "22%", height: "100%", background: "var(--orange)" }} />
            </div>
          </>
        ) : (
          <span
            style={{
              position: "absolute", bottom: 8, right: 8, fontFamily: "var(--font-mono)",
              fontSize: big ? 8.5 : 7.5, fontWeight: 600, background: "rgba(28,25,21,.74)",
              color: "rgba(255,255,255,.9)", borderRadius: 4, padding: "2px 5px",
            }}
          >
            {Math.floor(story.durationSeconds / 60)}:{String(story.durationSeconds % 60).padStart(2, "0")}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 9 }}>
        <span
          style={{
            fontSize: big ? 12 : 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden",
            textOverflow: "ellipsis", minWidth: 0, color: story.seen ? "var(--ink2)" : "var(--ink)",
          }}
        >
          {story.studentName}
        </span>
        {story.verified && (
          <span style={{ width: 13, height: 13, borderRadius: 999, background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, flex: "none" }}>
            ✓
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)", fontSize: big ? 9 : 8, fontWeight: 500, color: "var(--ink3)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1,
        }}
      >
        {story.seen ? "✓ " : ""}
        {story.contextLabel}
      </div>
    </button>
  );
}

export default function StoryRail() {
  const [stories, setStories] = useState<StoryFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    storiesApi
      .feed()
      .then((s) => !cancelled && setStories(s))
      // A failed rail must never break the dashboard — it just doesn't render.
      .catch(() => !cancelled && setStories([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  /** Fold viewer-side changes (seen, reactions) back in without refetching. */
  function patch(updated: StoryFeedItem) {
    setStories((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
  }

  const scroll = (dir: number) => scroller.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  // The design is explicit: no empty state. If nothing is scoped to this student, the rail
  // is not part of the page at all.
  if (loading || stories.length === 0) return null;

  const unwatched = stories.filter((s) => !s.seen).length;

  return (
    <>
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, padding: "18px 20px 16px", marginBottom: 24, boxShadow: "var(--e2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 15, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.2 }}>Success Stories</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, background: "var(--bg-sunk)", color: "var(--ink2)", borderRadius: 999, padding: "3px 9px" }}>
                {unwatched} NEW · {stories.length - unwatched} WATCHED
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 2 }}>
              Students in your segment, 20–25 seconds each
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <Link href="/student/stories" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--orange-deep)" }}>
            See all →
          </Link>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => scroll(-1)} className="story-step" aria-label="Scroll stories left">‹</button>
            <button onClick={() => scroll(1)} className="story-step" aria-label="Scroll stories right">›</button>
          </div>
        </div>

        <div ref={scroller} className="story-rail-scroll" style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
          {stories.map((s, i) => (
            <ResultCard key={s.id} story={s} width={134} onOpen={() => setOpenIndex(i)} />
          ))}
        </div>
      </div>

      {openIndex !== null && (
        <StoryViewer
          stories={stories}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          onStoryChange={patch}
        />
      )}
    </>
  );
}
