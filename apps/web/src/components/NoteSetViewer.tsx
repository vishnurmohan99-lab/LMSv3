"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StudentNoteSet } from "@/lib/api";
import { NoteScopeChip, contextLine } from "./NoteScopeChip";

/**
 * Paged reader for one note set — ported from Design System/Student - Notes.dc.html
 * (NT3 image pages, NT4 PDF, NT5v mobile).
 *
 * This replaces sending the student to a raw R2 URL in a new tab, which is what the feature
 * did before. It is a deliberate sibling of StoryViewer and shares its grammar: portalled to
 * body so the student shell's z-30 topbar and bottom nav can't crop it, swipe ←/→ to move,
 * swipe ↓ to close, visible arrows rather than invisible tap zones, safe-area insets.
 *
 * Handwriting is the content, so zoom is not optional — a page that can't be read close up
 * is no better than the Drive link this replaces.
 */

const SWIPE_PX = 48;
const ZOOMS = [1, 1.5, 2, 3];

export default function NoteSetViewer({ set, onClose }: { set: StudentNoteSet; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = ZOOMS[zoomIdx];
  const file = set.files[page];
  const total = set.files.length;

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swallowClick = useRef(false);

  const go = useCallback(
    (delta: number) => {
      setPage((p) => {
        const next = p + delta;
        if (next < 0 || next >= total) return p;
        setZoomIdx(0); // a new page starts fit-to-stage; carried zoom hides the top of it
        return next;
      });
    },
    [total],
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Same keyboard map as the story viewer, as the mockup's annotation asks for.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  function onTouchStart(e: React.TouchEvent) {
    swallowClick.current = false;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    // While zoomed the stage is pannable, so a drag is panning, not a page turn.
    if (!start || zoom !== 1) return;
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
  function onStageClick() {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
  }
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const cycleZoom = () => setZoomIdx((i) => (i + 1) % ZOOMS.length);

  if (!file || typeof document === "undefined") return null;

  const ctx = contextLine(set);
  const dateLabel = set.sessionDate
    ? `CLASS OF ${new Date(set.sessionDate).toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase()}`
    : null;

  const thumb = (i: number, opts: { w: number; h: number }) => (
    <button
      key={set.files[i].id}
      onClick={(e) => { stop(e); setPage(i); setZoomIdx(0); }}
      aria-label={`Page ${i + 1}`}
      aria-current={i === page}
      style={{
        position: "relative", width: opts.w, height: opts.h, flex: "none", padding: 0, cursor: "pointer",
        borderRadius: 7, overflow: "hidden", background: "#fdfbf6",
        border: i === page ? "2px solid var(--orange)" : "1px solid rgba(255,255,255,.18)",
        opacity: i === page ? 1 : 0.72,
      }}
    >
      {set.files[i].kind === "IMAGE" ? (
        // Presigned R2 URLs expire in ~1h; next/image would cache them past their lifetime.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={set.files[i].fileUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "var(--ink2)" }}>
          PDF
        </span>
      )}
      <span
        style={{
          position: "absolute", bottom: 3, right: 3, fontFamily: "var(--font-mono)", fontSize: 8.5,
          fontWeight: 700, background: "rgba(28,25,21,.74)", color: "#fff", borderRadius: 4, padding: "1px 5px",
        }}
      >
        {i + 1}
      </span>
    </button>
  );

  return createPortal(
    <div className="note-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label={set.title}>
      <div className="note-viewer" onClick={stop}>
        {/* ---- desktop top bar ---- */}
        <div className="note-topbar">
          <button
            onClick={onClose}
            aria-label="Back"
            style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", fontSize: 14, flex: "none", fontFamily: "inherit" }}
          >
            ←
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {set.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
              <NoteScopeChip scope={set.scope} dark />
              {(ctx || dateLabel) && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "rgba(255,255,255,.5)" }}>
                  {[ctx?.toUpperCase(), dateLabel].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
          </div>
          <div style={{ flex: 1 }} />

          {file.kind === "IMAGE" && (
            <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(255,255,255,.09)", borderRadius: 10, padding: 4 }}>
              <button onClick={() => setZoomIdx((i) => Math.max(0, i - 1))} aria-label="Zoom out" style={zoomBtn}>−</button>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,.8)", minWidth: 38, textAlign: "center" }}>
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={() => setZoomIdx((i) => Math.min(ZOOMS.length - 1, i + 1))} aria-label="Zoom in" style={zoomBtn}>+</button>
            </div>
          )}

          {/* Download stays available but is never required to read. */}
          <a
            href={file.fileUrl}
            download={file.fileName ?? undefined}
            target="_blank"
            rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,.72)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 10, padding: "8px 12px", flex: "none" }}
          >
            Download
          </a>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", fontSize: 13, flex: "none", fontFamily: "inherit" }}>
            ✕
          </button>
        </div>

        <div className="note-body">
          {total > 1 && (
            <div className="note-rail">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,.38)" }}>
                {total} PAGES
              </span>
              {set.files.map((_, i) => thumb(i, { w: 84, h: 112 }))}
            </div>
          )}

          {/* ---- page stage ---- */}
          <div className="note-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onStageClick}>
            <button className="note-mobile-close" onClick={(e) => { stop(e); onClose(); }} aria-label="Close"
              style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,.2)", background: "rgba(28,25,21,.55)", color: "#fff", cursor: "pointer", fontSize: 13, alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>
              ✕
            </button>

            {file.kind === "PDF" ? (
              // Rendered inline rather than handed to the browser's download.
              <iframe
                key={file.id}
                src={file.fileUrl}
                title={file.name}
                style={{ width: "100%", height: "100%", border: "none", background: "#fdfbf6" }}
              />
            ) : (
              // Presigned R2 URLs expire in ~1h; next/image would cache them past their lifetime.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={file.id}
                src={file.fileUrl}
                alt={file.name}
                onDoubleClick={cycleZoom}
                style={{
                  display: "block",
                  maxWidth: zoom === 1 ? "94%" : "none",
                  maxHeight: zoom === 1 ? "94%" : "none",
                  width: zoom === 1 ? "auto" : `${zoom * 94}%`,
                  borderRadius: 6,
                  boxShadow: "0 20px 48px rgba(0,0,0,.5)",
                  background: "#fdfbf6",
                  cursor: zoom === 1 ? "zoom-in" : "zoom-out",
                }}
              />
            )}

            {total > 1 && (
              <>
                <button className="note-nav note-nav-prev" onClick={(e) => { stop(e); go(-1); }} disabled={page === 0} aria-label="Previous page">‹</button>
                <button className="note-nav note-nav-next" onClick={(e) => { stop(e); go(1); }} disabled={page >= total - 1} aria-label="Next page">›</button>

                {/* The page indicator the client's spec is explicit about. */}
                <div
                  style={{
                    position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)",
                    display: "flex", alignItems: "center", gap: 9, background: "rgba(28,25,21,.72)",
                    border: "1px solid rgba(255,255,255,.13)", borderRadius: 999, padding: "7px 14px", zIndex: 2,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: 0.6 }}>
                    {page + 1} / {total}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {set.files.map((f, i) => (
                      <button
                        key={f.id}
                        onClick={(e) => { stop(e); setPage(i); setZoomIdx(0); }}
                        aria-label={`Go to page ${i + 1}`}
                        style={{
                          width: i === page ? 16 : 6, height: 6, borderRadius: 999, border: "none", padding: 0, cursor: "pointer",
                          background: i === page ? "var(--orange)" : "rgba(255,255,255,.34)", transition: "width .2s",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ---- mobile sheet ---- */}
          <div className="note-sheet">
            <div className="note-grabber" />
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{set.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
              <NoteScopeChip scope={set.scope} />
              {ctx && (
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink2)", background: "var(--bg-sunk)", borderRadius: 6, padding: "3px 8px" }}>{ctx}</span>
              )}
              {dateLabel && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink3)" }}>{dateLabel}</span>}
            </div>

            {total > 1 && (
              <div style={{ display: "flex", gap: 9, marginTop: 14, overflowX: "auto", marginRight: -16, paddingRight: 16 }}>
                {set.files.map((_, i) => thumb(i, { w: 58, h: 78 }))}
              </div>
            )}

            <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
              <a
                href={file.fileUrl}
                download={file.fileName ?? undefined}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 600, background: "var(--card)", color: "var(--ink2)", border: "1px solid var(--line)", borderRadius: 12, height: 44 }}
              >
                Download page
              </a>
              <button
                onClick={onClose}
                style={{ flex: 1, fontSize: 12.5, fontWeight: 600, background: "var(--card)", color: "var(--ink2)", border: "1px solid var(--line)", borderRadius: 12, height: 44, cursor: "pointer", fontFamily: "inherit" }}
              >
                Back to notes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const zoomBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent",
  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
