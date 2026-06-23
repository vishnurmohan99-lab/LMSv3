"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { questionBanksApi, uploadsApi, ApiError, type QuestionBank } from "@/lib/api";
import { useImageLightbox } from "@/components/ImageLightboxProvider";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 7,
        background: published ? "var(--green-soft)" : "var(--amber-soft)",
        color: published ? "var(--green)" : "var(--amber)",
      }}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

export default function FacultyQuestionBanksPage() {
  const openImage = useImageLightbox();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    questionBanksApi
      .list()
      .then(setBanks)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load question banks"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const bannerUrl = bannerFile ? await uploadsApi.uploadFile(bannerFile) : undefined;
      await questionBanksApi.create({ title, bannerUrl });
      setTitle("");
      setBannerFile(null);
      setShowAddForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create question bank");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Question Banks</div>
        <button
          onClick={() => setShowAddForm((s) => !s)}
          style={{
            padding: "10px 18px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {showAddForm ? "Close" : "+ Add question bank"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={onCreate}
          style={{ display: "grid", gap: 10, marginBottom: 22, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16 }}
        >
          <input required autoFocus placeholder="Question bank title" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} title="Banner image (optional)" />
          <button
            type="submit"
            disabled={creating}
            style={{
              padding: "10px 18px",
              background: "var(--ink)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: creating ? "default" : "pointer",
              opacity: creating ? 0.7 : 1,
              justifySelf: "start",
            }}
          >
            {creating ? "Creating…" : "Create question bank"}
          </button>
        </form>
      )}

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : banks.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No question banks yet. Create your first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {banks.map((bank) => (
            <Link
              key={bank.id}
              href={`/faculty/question-banks/${bank.id}`}
              className="entity-card"
              style={{ display: "block", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden" }}
            >
              {bank.bannerUrl ? (
                <div
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openImage(bank.bannerUrl!, bank.title);
                  }}
                  style={{ position: "relative", height: 110, background: `url(${bank.bannerUrl}) center/cover`, cursor: "pointer" }}
                >
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,.45))" }} />
                </div>
              ) : (
                <div className="banner-gradient-dark" style={{ position: "relative", height: 110, overflow: "hidden" }}>
                  <div
                    style={{
                      position: "absolute",
                      right: -30,
                      bottom: -30,
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(242,106,27,.35), transparent 70%)",
                    }}
                  />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div
                      className="banner-gradient-orange"
                      style={{ width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}
                    >
                      {initials(bank.title)}
                    </div>
                  </div>
                </div>
              )}
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{bank.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusBadge published={bank.published} />
                  <span style={{ fontSize: 12, color: "var(--ink2)" }}>
                    {bank._count?.questions ?? 0} question{bank._count?.questions === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
