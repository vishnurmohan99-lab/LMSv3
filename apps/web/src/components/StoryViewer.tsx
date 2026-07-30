"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { storiesApi, type StoryFeedItem } from "@/lib/api";

/**
 * Success Stories viewer — ported from Design System/Student - Stories.dc.html
 * ("Story Viewer — Portrait / Course CTA / Landscape source / Paused" and the mobile
 * ST6v "clip on top, story sheet below" screen).
 *
 * Two panes: a 9:16 clip stage and a context pane carrying the numbers, quote, CTA and an
 * explicit up-next queue. The design is emphatic that the clip never covers the substance,
 * that there are no invisible tap zones on desktop, and that a finished clip does NOT
 * auto-advance into the next student's story — the queue is manual.
 *
 * It portals to document.body: mounted inline it renders inside the student shell's flex
 * column, where the mobile topbar and bottom nav (both z-index 30 flex items) paint over
 * the scrim and crop the clip.
 */

const PING_EVERY_MS = 5000;
/** Past this, a touch is a swipe rather than a tap. */
const SWIPE_PX = 48;

function StatCell({ stat }: { stat: { label: string; value: string; unit?: string } }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 13, padding: "12px 14px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: 1.1, color: "var(--ink3)" }}>
        {stat.label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 21, fontWeight: 800, marginTop: 4, letterSpacing: -0.4 }}>
        {stat.value}
        {stat.unit && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink2)" }}>{stat.unit}</span>}
      </div>
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function StoryViewer({
  stories,
  index,
  onIndexChange,
  onClose,
  onStoryChange,
}: {
  stories: StoryFeedItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  /** Lets the rail update seen/reaction state without refetching the whole feed. */
  onStoryChange?: (story: StoryFeedItem) => void;
}) {
  const router = useRouter();
  const story = stories[index];
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState(false);
  const [reacted, setReacted] = useState(story?.reacted ?? false);
  const [reactionCount, setReactionCount] = useState(story?.reactionCount ?? 0);
  /** Which way the queue last moved, so the slide animation matches the gesture. */
  const [dir, setDir] = useState<1 | -1>(1);

  // Keep the furthest point reached in a ref so pings and unmount read a live value
  // without re-running effects on every timeupdate.
  const watchedRef = useRef(0);
  const completedRef = useRef(false);
  const storyIdRef = useRef(story?.id);

  const duration = story?.durationSeconds || 0;
  const pct = duration ? Math.min(100, (elapsed / duration) * 100) : 0;

  /** Flush progress for whichever story the refs currently point at. */
  const flush = useCallback((opened = false) => {
    const id = storyIdRef.current;
    if (!id) return;
    storiesApi
      .view(id, { watchedSeconds: Math.floor(watchedRef.current), completed: completedRef.current, opened })
      .catch(() => {});
  }, []);

  // Reset per-story state and count an open.
  useEffect(() => {
    if (!story) return;
    storyIdRef.current = story.id;
    watchedRef.current = 0;
    completedRef.current = false;
    setElapsed(0);
    setPaused(false);
    setFailed(false);
    setReacted(story.reacted);
    setReactionCount(story.reactionCount);
    flush(true);
    onStoryChange?.({ ...story, seen: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // Periodic progress ping + a final flush when the viewer closes.
  useEffect(() => {
    const t = setInterval(() => flush(), PING_EVERY_MS);
    return () => {
      clearInterval(t);
      flush();
    };
  }, [flush]);

  // The design's sound-on default: the card click is the user gesture that permits it, but
  // browsers can still refuse — fall back to muted playback rather than a dead player.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    const p = v.play();
    if (p) {
      p.catch(() => {
        v.muted = true;
        setMuted(true);
        v.play().catch(() => setFailed(true));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // The viewer owns the whole screen on mobile — the page behind it must not scroll under
  // the sheet when a swipe overshoots.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next >= stories.length) return;
      setDir(delta > 0 ? 1 : -1);
      onIndexChange(next);
    },
    [index, stories.length, onIndexChange],
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  }, []);

  /**
   * Clip gestures, per the mockup's gesture map: horizontal swipe moves between stories,
   * a downward swipe closes, and anything that isn't a swipe is a play/pause tap. The
   * synthetic click that follows a swipe is swallowed so it can't also toggle playback.
   */
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swallowClick = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    // Clear here rather than in the click handler: if a browser skips the synthetic click
    // a stale flag would otherwise eat the next genuine tap.
    swallowClick.current = false;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_PX) {
      swallowClick.current = true;
      go(dx < 0 ? 1 : -1);
    } else if (dy > SWIPE_PX * 1.5 && Math.abs(dy) > Math.abs(dx)) {
      swallowClick.current = true;
      onClose();
    }
  }
  function onClipClick() {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    togglePlay();
  }
  /** Controls layered over the clip must not also count as a play/pause tap. */
  const stop = (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation();

  // Desktop keyboard map, exactly as annotated in the mockup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === "m") {
        setMuted((m) => {
          if (videoRef.current) videoRef.current.muted = !m;
          return !m;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, togglePlay]);

  // captionsVtt is stored as text, so it needs an object URL to become a <track>.
  const captionUrl = useMemo(() => {
    if (!story?.captionsVtt) return null;
    return URL.createObjectURL(new Blob([story.captionsVtt], { type: "text/vtt" }));
  }, [story?.captionsVtt]);
  useEffect(() => () => {
    if (captionUrl) URL.revokeObjectURL(captionUrl);
  }, [captionUrl]);

  async function toggleReaction() {
    if (!story) return;
    try {
      const r = await storiesApi.react(story.id);
      setReacted(r.reacted);
      setReactionCount(r.reactionCount);
      onStoryChange?.({ ...story, seen: true, reacted: r.reacted, reactionCount: r.reactionCount });
    } catch {
      /* a failed reaction shouldn't disturb playback */
    }
  }

  // The viewer only ever renders from post-hydration click state, so the SSR pass never
  // reaches here — this just keeps createPortal off a server render.
  if (!story || typeof document === "undefined") return null;
  const upNext = stories.slice(index + 1, index + 4);
  const posted = new Date(story.createdAt);
  const hoursAgo = Math.max(1, Math.round((Date.now() - posted.getTime()) / 3600000));
  const postedLabel = hoursAgo < 24 ? `POSTED ${hoursAgo}H AGO` : `POSTED ${Math.round(hoursAgo / 24)}D AGO`;
  const anim = dir > 0 ? "story-anim-next" : "story-anim-prev";
  // Only a genuinely landscape source letterboxes. A portrait clip fills the stage the way
  // a reel does — contain on 9:16 leaves the pillarbox that made this look broken.
  const objectFit = story.orientation === "LANDSCAPE" ? "contain" : "cover";

  return createPortal(
    <div
      className="story-scrim"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Success story from ${story.studentName}`}
    >
      <div className="story-viewer fade-in-up" onClick={(e) => e.stopPropagation()}>
        {/* ---- clip pane ---- */}
        <div
          key={`clip-${story.id}`}
          className={`story-clip ${anim}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={onClipClick}
        >
          {story.videoUrl && !failed ? (
            <video
              ref={videoRef}
              src={story.videoUrl}
              poster={story.posterUrl ?? undefined}
              playsInline
              style={{ display: "block", width: "100%", height: "100%", objectFit, background: "#141110" }}
              onTimeUpdate={(e) => {
                const t = e.currentTarget.currentTime;
                setElapsed(t);
                watchedRef.current = Math.max(watchedRef.current, t);
              }}
              onEnded={() => {
                completedRef.current = true;
                watchedRef.current = Math.max(watchedRef.current, duration);
                setPaused(true);
                flush(); // no auto-advance — the design replaces it with the up-next queue
              }}
              onError={() => setFailed(true)}
            />
          ) : (
            // Slow network / missing stream: the poster and the written story still carry it.
            <div
              style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 16,
                background: story.posterUrl ? `center/cover no-repeat url(${story.posterUrl})` : "linear-gradient(165deg,#2b2521,#1a1614)",
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: "rgba(20,17,16,.55)" }} />
              <button
                onClick={(e) => { stop(e); setFailed(false); }}
                aria-label="Play story"
                style={{
                  position: "relative", width: 62, height: 62, borderRadius: 999, border: "none",
                  background: "rgba(255,255,255,.92)", cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center", boxShadow: "0 12px 28px rgba(0,0,0,.35)",
                }}
              >
                <span style={{ marginLeft: 5, borderLeft: "19px solid var(--ink)", borderTop: "12px solid transparent", borderBottom: "12px solid transparent" }} />
              </button>
              <span style={{ position: "relative", fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: 1.4, color: "rgba(255,255,255,.6)" }}>
                TAP TO PLAY
              </span>
            </div>
          )}

          {captionUrl && (
            <video style={{ display: "none" }}>
              <track kind="captions" src={captionUrl} default label="Captions" />
            </video>
          )}

          <span
            style={{
              position: "absolute", top: "calc(16px + env(safe-area-inset-top))", left: 16,
              fontFamily: "var(--font-mono)", fontSize: 9,
              fontWeight: 700, letterSpacing: 1.2, background: "rgba(255,255,255,.16)", color: "#fff",
              borderRadius: 6, padding: "5px 9px",
            }}
          >
            {story.resultChip}
          </span>

          {/* Mobile only — the sheet's ✕ scrolls away, this one never does. */}
          <button
            className="story-clip-close"
            onClick={(e) => { stop(e); onClose(); }}
            aria-label="Close story"
            style={{
              width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,.22)",
              background: "rgba(28,25,21,.55)", color: "#fff", cursor: "pointer", fontSize: 13,
              alignItems: "center", justifyContent: "center", fontFamily: "inherit",
            }}
          >
            ✕
          </button>

          <div style={{ position: "absolute", bottom: 22, left: 16, right: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={(e) => {
                stop(e);
                setMuted((m) => {
                  if (videoRef.current) videoRef.current.muted = !m;
                  return !m;
                });
              }}
              aria-label={muted ? "Unmute" : "Mute"}
              style={{ width: 30, height: 30, borderRadius: 9, border: "none", background: `rgba(255,255,255,${muted ? 0.16 : 0.26})`, color: "#fff", cursor: "pointer", fontSize: 12, flex: "none" }}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button
              onClick={(e) => { stop(e); togglePlay(); }}
              aria-label={paused ? "Play" : "Pause"}
              style={{ width: 30, height: 30, borderRadius: 9, border: "none", background: "rgba(255,255,255,.16)", color: "#fff", cursor: "pointer", fontSize: 11, flex: "none" }}
            >
              {paused ? "▶" : "❚❚"}
            </button>
            {story.captionsVtt && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 600, letterSpacing: 0.7, background: "rgba(255,255,255,.16)", color: "#fff", borderRadius: 6, padding: "6px 8px" }}>
                CC
              </span>
            )}
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,.6)" }}>
              {fmt(elapsed)} / {fmt(duration)}
            </span>
          </div>

          {/* One clip, one progress line — not a segmented set to tap through. */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "rgba(255,255,255,.2)" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "var(--orange)", transition: "width .2s linear" }} />
          </div>

          {/* Mobile-only prev/next — visible controls, never invisible tap zones. */}
          <button className="story-nav story-nav-prev" onClick={(e) => { stop(e); go(-1); }} disabled={index === 0} aria-label="Previous story">‹</button>
          <button className="story-nav story-nav-next" onClick={(e) => { stop(e); go(1); }} disabled={index >= stories.length - 1} aria-label="Next story">›</button>
        </div>

        {/* ---- context pane ---- */}
        <div key={`ctx-${story.id}`} className={`story-context ${anim}`}>
          <div className="story-grabber" />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: "var(--purple-soft)", color: "var(--purple-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flex: "none" }}>
              {story.avatarInitials || story.studentName.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{story.studentName}</span>
                {story.verified && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, letterSpacing: 0.6, background: "var(--green-soft)", color: "var(--green)", borderRadius: 5, padding: "3px 7px" }}>
                    ✓ VERIFIED RESULT
                  </span>
                )}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 500, color: "var(--ink2)", marginTop: 3 }}>
                {[story.contextLabel, postedLabel].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: 16, fontWeight: 600, color: "var(--ink3)", cursor: "pointer", flex: "none", fontFamily: "inherit" }}>
              ✕
            </button>
          </div>

          {story.stats.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(3, story.stats.length)}, 1fr)`, gap: 9, marginTop: 20 }}>
              {story.stats.slice(0, 3).map((s, i) => <StatCell key={i} stat={s} />)}
            </div>
          )}

          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.5, letterSpacing: -0.2, marginTop: 22 }}>
            &ldquo;{story.quote}&rdquo;
          </div>
          {story.body && (
            <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--ink2)", marginTop: 12, maxWidth: 560 }}>{story.body}</p>
          )}

          <div style={{ display: "flex", gap: 7, marginTop: 14, flexWrap: "wrap" }}>
            {story.captionsVtt && <span className="story-meta-chip">CAPTIONS</span>}
            {story.orientation === "LANDSCAPE" && <span className="story-meta-chip">16:9 LETTERBOXED</span>}
            {duration > 0 && <span className="story-meta-chip">{fmt(duration)} RUNTIME</span>}
          </div>

          {story.course && (
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, padding: 15, marginTop: 20, boxShadow: "var(--e2)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, color: "var(--ink3)", marginBottom: 11 }}>
                THE COURSE IN THIS STORY
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: "var(--purple-soft)", color: "var(--purple-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 800, flex: "none" }}>
                  {story.course.title.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>{story.course.title}</div>
                </div>
                <button
                  className="story-cta"
                  onClick={() => router.push(story.ctaUrl || `/student/courses/${story.course!.id}`)}
                  style={{ fontSize: 13, fontWeight: 600, background: "var(--orange)", color: "#fff", border: "none", borderRadius: 11, height: 42, padding: "0 18px", cursor: "pointer", flex: "none", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(242,106,27,.3)" }}
                >
                  {story.ctaLabel || "Enroll in this course →"}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <button
              onClick={toggleReaction}
              aria-pressed={reacted}
              style={{
                display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
                borderRadius: 999, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${reacted ? "var(--orange)" : "var(--line)"}`,
                background: reacted ? "var(--orange-soft)" : "var(--card)",
                color: reacted ? "var(--orange-deep)" : "var(--ink2)",
              }}
            >
              🔥 Inspiring <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11.5 }}>{reactionCount}</span>
            </button>
            {story.ctaUrl && !story.course && (
              <a href={story.ctaUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink2)", border: "1px solid var(--line)", borderRadius: 999, padding: "8px 14px", background: "var(--card)" }}>
                {story.ctaLabel || "Read full story"}
              </a>
            )}
          </div>

          {upNext.length > 0 && (
            <div style={{ marginTop: "auto", paddingTop: 22 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 9 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: 1, color: "var(--ink2)" }}>UP NEXT</div>
                <div style={{ flex: 1 }} />
                <button onClick={() => go(-1)} disabled={index === 0} className="story-step" aria-label="Previous story">‹</button>
                <button onClick={() => go(1)} disabled={index >= stories.length - 1} className="story-step" aria-label="Next story">›</button>
              </div>
              <div className="story-upnext">
                {upNext.map((u, i) => (
                  <button
                    key={u.id}
                    onClick={() => go(i + 1)}
                    style={{ display: "flex", gap: 9, alignItems: "center", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 8, cursor: "pointer", minWidth: 0, textAlign: "left", fontFamily: "inherit" }}
                  >
                    <div style={{ width: 34, height: 46, borderRadius: 7, background: u.posterUrl ? `center/cover no-repeat url(${u.posterUrl})` : "linear-gradient(160deg,#3b332e,#1f1a17)", flex: "none" }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.studentName}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink3)" }}>
                        {u.resultChip} · {fmt(u.durationSeconds)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
