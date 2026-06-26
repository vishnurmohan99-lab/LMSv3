"use client";

import { useRef, useState, useEffect } from "react";
import { cheatSheetApi, ApiError, type CheatSheet } from "@/lib/api";

export default function CheatSheetReview({ lessonId, lessonTitle }: { lessonId: string; lessonTitle?: string }) {
  const [sheet, setSheet] = useState<CheatSheet | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setIndex(0);
    cheatSheetApi
      .get(lessonId)
      .then(setSheet)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load cheat sheet"))
      .finally(() => setLoading(false));
  }, [lessonId]);

  const pages = sheet?.pages ?? [];

  function goNext() {
    setIndex((i) => Math.min(pages.length - 1, i + 1));
  }
  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -50) goNext();
    else if (delta > 50) goPrev();
    touchStartX.current = null;
  }

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading cheat sheet…</p>;
  if (error) return <p style={{ color: "var(--red)" }}>{error}</p>;
  if (pages.length === 0) {
    return (
      <div style={{ padding: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, color: "var(--ink2)" }}>
        No cheat sheet has been generated for this lesson yet.
      </div>
    );
  }

  const page = pages[index];

  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1,
            color: "var(--orange)",
            background: "var(--orange-soft)",
            padding: "5px 11px",
            borderRadius: 8,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          📝 Cheat Sheet
        </span>
        {lessonTitle && (
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lessonTitle}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        {pages.map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              background: i <= index ? "var(--orange)" : "var(--bg)",
              border: i <= index ? "none" : "1px solid var(--line)",
              transition: "background .2s",
            }}
          />
        ))}
      </div>

      <div style={{ fontSize: 12, color: "var(--ink3)", textAlign: "center", marginBottom: 12 }}>
        Page {index + 1} of {pages.length} — swipe or use the arrows
      </div>

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="fade-in-up"
        key={index}
        style={{
          aspectRatio: "3 / 4",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rl)",
          boxShadow: "0 16px 40px rgba(242,106,27,.10)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 12, flex: "none" }}>{page.title}</div>

        {page.illustrationUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.illustrationUrl}
            alt={page.title}
            style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 12, marginBottom: 12, flex: "none" }}
          />
        )}

        <ul style={{ fontSize: 14, lineHeight: 1.7, color: "var(--ink2)", margin: 0, paddingLeft: 20, flex: 1, overflowY: "auto" }}>
          {page.bullets.map((b, bi) => (
            <li key={bi} style={{ marginBottom: 6 }}>
              {b}
            </li>
          ))}
        </ul>

        {page.table && (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginTop: 10, flex: "none" }}>
            <thead>
              <tr>
                {page.table.headers.map((h, hi) => (
                  <th key={hi} style={{ textAlign: "left", padding: "5px 7px", borderBottom: "1px solid var(--line)", color: "var(--ink2)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.table.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: "5px 7px", borderBottom: "1px solid var(--line2)" }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {page.examTip && (
          <div
            style={{
              marginTop: 12,
              flex: "none",
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--amber)",
              background: "var(--amber-soft)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            💡 {page.examTip}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
        <button
          onClick={goPrev}
          disabled={index === 0}
          style={{
            padding: "11px 22px",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: index === 0 ? "default" : "pointer",
            opacity: index === 0 ? 0.5 : 1,
            color: "var(--ink)",
          }}
        >
          ‹ Previous
        </button>
        <button
          onClick={goNext}
          disabled={index === pages.length - 1}
          style={{
            padding: "11px 22px",
            background: "var(--orange)",
            border: "none",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: index === pages.length - 1 ? "default" : "pointer",
            opacity: index === pages.length - 1 ? 0.5 : 1,
            color: "#fff",
          }}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
