"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cheatSheetApi, ApiError, type CheatSheet } from "@/lib/api";
import CheatSheetPoster from "@/components/CheatSheetPoster";

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
    <main className="mobile-page-pad" style={{ padding: 40, maxWidth: 1000 }}>
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
        <CheatSheetPoster pages={sheet.pages} />
      )}
    </main>
  );
}
