"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cheatSheetApi, uploadsApi, ApiError, type CheatSheet } from "@/lib/api";
import CheatSheetPoster from "@/components/CheatSheetPoster";

export default function ManageCheatSheetPage() {
  const params = useParams<{ id: string; lessonId: string }>();
  const { id: courseId, lessonId } = params;

  const [sheet, setSheet] = useState<CheatSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);

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

  async function onUploadPoster(file: File | null) {
    if (!file) return;
    setError(null);
    setUploadingPoster(true);
    try {
      const key = await uploadsApi.uploadFile(file);
      const updated = await cheatSheetApi.setPoster(lessonId, key);
      setSheet(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload poster");
    } finally {
      setUploadingPoster(false);
    }
  }

  async function onRemovePoster() {
    setError(null);
    try {
      const updated = await cheatSheetApi.removePoster(lessonId);
      setSheet(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove poster");
    }
  }

  const hasContent = !!sheet && (sheet.pages.length > 0 || !!sheet.posterImageUrl);

  return (
    <main style={{ padding: 40, maxWidth: 1000 }}>
      <Link href={`/admin/courses/${courseId}`} style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
        ← Back to course
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 22, gap: 12, flexWrap: "wrap" }}>
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
          {generating ? "Generating…" : sheet && sheet.pages.length > 0 ? "Regenerate with AI" : "Generate with AI"}
        </button>
      </div>

      <p style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 16 }}>
        Generate an AI infographic from the PDF, and/or upload your own finished poster image below — it&apos;s shown full and
        never cropped.
      </p>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "14px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Own poster image</div>
        <label
          style={{ padding: "8px 14px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: uploadingPoster ? "default" : "pointer", opacity: uploadingPoster ? 0.6 : 1 }}
        >
          {uploadingPoster ? "Uploading…" : sheet?.posterImageUrl ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploadingPoster}
            onChange={(e) => onUploadPoster(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
          />
        </label>
        {sheet?.posterImageUrl && (
          <button onClick={onRemovePoster} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            Remove
          </button>
        )}
        <span style={{ fontSize: 11.5, color: "var(--ink3)" }}>PNG/JPG/WebP · a tall poster is fine, it won&apos;t be cropped.</span>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : !hasContent ? (
        <p style={{ color: "var(--ink2)" }}>No cheat sheet yet — generate one with AI or upload your own poster above.</p>
      ) : (
        <CheatSheetPoster pages={sheet!.pages} posterImageUrl={sheet!.posterImageUrl} />
      )}
    </main>
  );
}
