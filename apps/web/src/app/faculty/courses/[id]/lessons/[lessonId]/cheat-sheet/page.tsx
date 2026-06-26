"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cheatSheetApi, ApiError, type CheatSheet } from "@/lib/api";

export default function ManageCheatSheetPage() {
  const params = useParams<{ id: string; lessonId: string }>();
  const { id: courseId, lessonId } = params;

  const [sheet, setSheet] = useState<CheatSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  function load() {
    setLoading(true);
    cheatSheetApi
      .get(lessonId)
      .then(setSheet)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load cheat sheet"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [lessonId]);

  async function onGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const result = await cheatSheetApi.generate(lessonId);
      setSheet(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate cheat sheet");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main style={{ padding: 40, maxWidth: 1000 }}>
      <Link href={`/faculty/courses/${courseId}`} style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
        ← Back to course
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Cheat Sheet</h1>
        <button
          onClick={onGenerate}
          disabled={generating}
          style={{
            padding: "9px 16px",
            background: "var(--orange)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: generating ? "default" : "pointer",
            opacity: generating ? 0.7 : 1,
          }}
        >
          {generating ? "Generating…" : sheet ? "Regenerate with AI" : "Generate with AI"}
        </button>
      </div>

      <p style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 16 }}>
        Rewrites the PDF into concise revision pages with bullet points, tables, exam tips, and an AI-generated illustration per
        page. Generation can take a minute or two.
      </p>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : !sheet || sheet.pages.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No cheat sheet has been generated for this lesson yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {sheet.pages.map((page, i) => (
            <div
              key={i}
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rl)",
                padding: 18,
                aspectRatio: "3 / 4",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--orange)", marginBottom: 6 }}>PAGE {i + 1}</div>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{page.title}</div>

              {page.illustrationUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.illustrationUrl}
                  alt={page.title}
                  style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10, marginBottom: 10, flex: "none" }}
                />
              )}

              <ul style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink2)", margin: 0, paddingLeft: 18, flex: 1, overflowY: "auto" }}>
                {page.bullets.map((b, bi) => (
                  <li key={bi} style={{ marginBottom: 4 }}>
                    {b}
                  </li>
                ))}
              </ul>

              {page.table && (
                <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginTop: 8 }}>
                  <thead>
                    <tr>
                      {page.table.headers.map((h, hi) => (
                        <th key={hi} style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid var(--line)", color: "var(--ink2)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {page.table.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ padding: "4px 6px", borderBottom: "1px solid var(--line2)" }}>
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
                    marginTop: 10,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--amber)",
                    background: "var(--amber-soft)",
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  💡 {page.examTip}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
