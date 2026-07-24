"use client";

import { useEffect, useState } from "react";

/**
 * Rise launch splash — ported from Design System/Splash - Rise(.- Web). Rendered in
 * the root layout so it is present in the server HTML and covers the app on the very
 * first paint (no data, no flash of the app underneath). It then fades out and unmounts.
 *
 * Shown once per browser session: a cold launch (new tab, or a PWA opened from the home
 * screen) gets the splash; refreshes while working within that session do not, so it is
 * a launch flourish rather than a tax on every reload. SPA route changes never remount it
 * because the root layout persists across them.
 *
 * The markup is deliberately server-rendered; only the dismiss timing is client-side, so
 * there is no window where the app shows before the splash.
 */

const SESSION_KEY = "rise-splash-shown";
// The intro animations settle by ~1.2s (chevron drop + lockup fade-up), so this holds a
// clear beat on the finished screen before fading. ~2.7s total including the fade.
const HOLD_MS = 2200;
const FADE_MS = 500; // matches the rise-out keyframe

export default function RiseSplash() {
  // Assume "show" on the server and first client render so the SSR HTML always contains
  // the splash. The effect decides, on the client, whether to keep or immediately drop it.
  const [phase, setPhase] = useState<"show" | "out" | "gone">("show");

  useEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      /* storage blocked (private mode) — treat as a fresh launch */
    }
    if (alreadyShown) {
      setPhase("gone");
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Reduced-motion still sees the screen, just a touch shorter (no intro to wait out).
    const hold = reduce ? 1200 : HOLD_MS;
    const toFade = setTimeout(() => setPhase("out"), hold);
    const toGone = setTimeout(() => setPhase("gone"), hold + FADE_MS);
    return () => {
      clearTimeout(toFade);
      clearTimeout(toGone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={`rise-splash${phase === "out" ? " rise-splash--out" : ""}`} role="status" aria-label="Loading Rise" aria-live="polite">
      <div className="rise-glow" aria-hidden />

      <div className="rise-center">
        <div className="rise-logo">
          <svg viewBox="0 0 100 100" fill="none" aria-hidden>
            <polyline className="rise-chev" points="22,52 50,26 78,52" stroke="#fff" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
            <polyline className="rise-chev-faint" points="22,74 50,48 78,74" stroke="#fff" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="rise-lockup">
          <div className="rise-word">Rise</div>
          {/* non-breaking hyphen, as in the mockup, so "E-learning" never wraps */}
          <div className="rise-caption">E&#8209;learning</div>
        </div>
      </div>

      <div className="rise-footer">
        <div className="rise-track">
          <span />
        </div>
        <div className="rise-tagline">Keep climbing</div>
      </div>
    </div>
  );
}
