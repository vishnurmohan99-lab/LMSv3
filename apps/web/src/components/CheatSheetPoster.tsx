"use client";

import type { CheatSheetPage } from "@/lib/api";

/** Section accent colors cycled per topic — all from the theme token palette. */
const ACCENTS = [
  { color: "var(--orange)", soft: "var(--orange-soft)" },
  { color: "var(--purple)", soft: "var(--purple-soft)" },
  { color: "var(--green)", soft: "var(--green-soft)" },
  { color: "var(--blue)", soft: "var(--blue-soft)" },
  { color: "var(--amber)", soft: "var(--amber-soft)" },
  { color: "var(--red)", soft: "var(--red-soft)" },
];

function SectionIcon({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

/**
 * Renders a cheat sheet as a single designed infographic "poster": a header band plus
 * numbered, color-coded sections with icon-bulleted points, styled tables, and exam-tip
 * callouts. Real rendered text (accurate + crisp) — no AI-drawn images.
 */
export default function CheatSheetPoster({ pages, title }: { pages: CheatSheetPage[]; title?: string }) {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          background: "linear-gradient(135deg,#1c1c1c,#2c2620)",
          color: "#fff",
          borderRadius: "var(--rl)",
          padding: "22px 26px",
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "#f7b274", textTransform: "uppercase" }}>Cheat Sheet</div>
          {title && <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, marginTop: 4 }}>{title}</div>}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.7)", background: "rgba(255,255,255,.1)", padding: "6px 13px", borderRadius: 9, whiteSpace: "nowrap" }}>
          {pages.length} key {pages.length === 1 ? "topic" : "topics"}
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {pages.map((page, i) => {
          const a = ACCENTS[i % ACCENTS.length];
          return (
            <section
              key={i}
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rl)",
                overflow: "hidden",
                boxShadow: "0 2px 10px rgba(0,0,0,.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", background: a.soft, borderLeft: `5px solid ${a.color}` }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    background: a.color,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 14,
                    flex: "none",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.2, color: "var(--ink)", flex: 1 }}>{page.title}</span>
                <SectionIcon color={a.color} />
              </div>

              <div style={{ padding: 18 }}>
                {page.bullets.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: page.bullets.length > 3 ? "repeat(auto-fit, minmax(240px, 1fr))" : "1fr", gap: "8px 20px" }}>
                    {page.bullets.map((b, bi) => (
                      <div key={bi} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.color, flex: "none", marginTop: 8 }} />
                        <span style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink2)" }}>{b}</span>
                      </div>
                    ))}
                  </div>
                )}

                {page.table && (
                  <div style={{ overflowX: "auto", marginTop: page.bullets.length > 0 ? 14 : 0 }}>
                    <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", minWidth: 320 }}>
                      <thead>
                        <tr>
                          {page.table.headers.map((h, hi) => (
                            <th key={hi} style={{ textAlign: "left", padding: "7px 10px", background: a.soft, color: a.color, fontWeight: 800, borderBottom: `2px solid ${a.color}`, whiteSpace: "nowrap" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {page.table.rows.map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td key={ci} style={{ padding: "7px 10px", borderBottom: "1px solid var(--line2)", color: "var(--ink2)" }}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {page.examTip && (
                  <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 14, background: "var(--amber-soft)", borderRadius: 11, padding: "11px 13px" }}>
                    <span style={{ fontSize: 14, flex: "none" }}>💡</span>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "var(--amber)", textTransform: "uppercase", marginBottom: 2 }}>Exam Tip</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)", lineHeight: 1.5 }}>{page.examTip}</div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
