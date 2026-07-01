"use client";

import { useState, useEffect } from "react";
import { cheatSheetApi, ApiError, type CheatSheet } from "@/lib/api";
import CheatSheetPoster from "./CheatSheetPoster";

export default function CheatSheetReview({ lessonId, lessonTitle }: { lessonId: string; lessonTitle?: string }) {
  const [sheet, setSheet] = useState<CheatSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    cheatSheetApi
      .get(lessonId)
      .then(setSheet)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load cheat sheet"))
      .finally(() => setLoading(false));
  }, [lessonId]);

  if (loading) return <p style={{ color: "var(--ink2)" }}>Loading cheat sheet…</p>;
  if (error) return <p style={{ color: "var(--red)" }}>{error}</p>;

  const pages = sheet?.pages ?? [];
  if (pages.length === 0 && !sheet?.posterImageUrl) {
    return (
      <div style={{ padding: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, color: "var(--ink2)" }}>
        No cheat sheet has been generated for this lesson yet.
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      <CheatSheetPoster pages={pages} title={lessonTitle} posterImageUrl={sheet?.posterImageUrl} />
    </div>
  );
}
