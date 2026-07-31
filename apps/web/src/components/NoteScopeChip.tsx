"use client";

import type { NoteScope, StudentNoteSet } from "@/lib/api";

/**
 * Scope chip — Design System/Student - Notes.dc.html, component 01.
 *
 * Answers "where does this apply to me?" before the title is read. Colour is the fast signal;
 * the glyph carries it for anyone who can't use colour, which is why every chip has one.
 */

const SCOPE: Record<NoteScope, { glyph: string; bg: string; fg: string; darkBg: string; darkFg: string }> = {
  GENERAL: { glyph: "◉", bg: "var(--bg-sunk)", fg: "var(--ink2)", darkBg: "rgba(255,255,255,.14)", darkFg: "rgba(255,255,255,.72)" },
  COURSE: { glyph: "▦", bg: "var(--purple-soft)", fg: "var(--purple-ink)", darkBg: "rgba(124,92,252,.22)", darkFg: "#c4b1ff" },
  BATCH: { glyph: "◈", bg: "var(--orange-soft)", fg: "var(--orange-ink)", darkBg: "rgba(242,106,27,.22)", darkFg: "#fbb277" },
  LESSON: { glyph: "▸", bg: "var(--blue-soft)", fg: "var(--blue)", darkBg: "rgba(46,125,224,.2)", darkFg: "#9dc4f5" },
};

export function NoteScopeChip({ scope, dark = false }: { scope: NoteScope; dark?: boolean }) {
  const s = SCOPE[scope] ?? SCOPE.GENERAL;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, flex: "none",
        fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: 0.8,
        background: dark ? s.darkBg : s.bg,
        color: dark ? s.darkFg : s.fg,
        borderRadius: 5, padding: "3px 7px",
      }}
    >
      <span style={{ fontSize: 10, lineHeight: 1 }}>{s.glyph}</span>
      {scope}
    </span>
  );
}

/**
 * The human context line for a set — course, lesson, or batch names.
 * Returns null for GENERAL: it belongs to no course, and the mockup is explicit that this
 * means no chip at all rather than a placeholder.
 */
export function contextLine(set: StudentNoteSet): string | null {
  if (set.scope === "GENERAL") return null;
  if (set.scope === "LESSON") return [set.course?.title, set.lesson?.title].filter(Boolean).join(" — ") || null;
  if (set.scope === "COURSE") return set.course?.title ?? null;
  return set.batches.map((b) => b.name).join(", ") || null;
}
