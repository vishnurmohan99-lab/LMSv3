"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { questionBanksApi, uploadsApi, ApiError, type QuestionBank } from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import { useConfirm } from "@/components/ConfirmProvider";

const BANNER_HEIGHT = 110;

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function CardBanner({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <div style={{ position: "relative", height: BANNER_HEIGHT, background: `url(${url}) center/cover` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,.45))" }} />
      </div>
    );
  }
  return (
    <div className="banner-gradient-dark" style={{ position: "relative", height: BANNER_HEIGHT, overflow: "hidden" }}>
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
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {initials(name)}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
};

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.8">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.8">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  );
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

export default function AdminQuestionBanksPage() {
  const confirm = useConfirm();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  function load() {
    setLoading(true);
    questionBanksApi
      .list()
      .then(setBanks)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load question banks"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filteredBanks = useMemo(
    () => banks.filter((b) => b.title.toLowerCase().includes(search.toLowerCase())),
    [banks, search],
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const bannerUrl = bannerFile ? await uploadsApi.uploadFile(bannerFile) : undefined;
      await questionBanksApi.create({ title, bannerUrl });
      setTitle("");
      setBannerFile(null);
      setShowAddModal(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create question bank");
    } finally {
      setCreating(false);
    }
  }

  async function onSaveRename(id: string) {
    try {
      await questionBanksApi.update(id, { title: editingTitle });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to rename question bank");
    }
  }

  async function onDelete(id: string) {
    if (!(await confirm({ message: "Delete this question bank and all its questions? This cannot be undone." }))) return;
    try {
      await questionBanksApi.remove(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete question bank");
    }
  }

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Question Banks</div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
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
          <PlusIcon />
          Add question bank
        </button>
      </div>

      {showAddModal && (
        <Modal title="Add question bank" onClose={() => setShowAddModal(false)}>
          <form onSubmit={onCreate} style={{ display: "grid", gap: 14 }}>
            <input
              required
              autoFocus
              placeholder="Question bank title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>
                Banner image (optional)
              </div>
              <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
            </div>
            <button
              type="submit"
              disabled={creating}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "11px 20px",
                background: "var(--ink)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: creating ? "default" : "pointer",
                opacity: creating ? 0.6 : 1,
              }}
            >
              {creating && <Spinner />}
              {creating ? "Creating…" : "Create question bank"}
            </button>
          </form>
        </Modal>
      )}

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <input
        placeholder="Search question banks…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputStyle, width: "100%", marginBottom: 16 }}
      />

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : filteredBanks.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No question banks match.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {filteredBanks.map((bank) => (
            <div
              key={bank.id}
              className="entity-card"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rl)",
                overflow: "hidden",
              }}
            >
              <CardBanner url={bank.bannerUrl} name={bank.title} />
              <div style={{ padding: 16 }}>
                {editingId === bank.id ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSaveRename(bank.id)}
                    style={{ ...inputStyle, padding: "6px 10px", marginBottom: 8 }}
                  />
                ) : (
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{bank.title}</div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <StatusBadge published={bank.published} />
                  <span style={{ fontSize: 12, color: "var(--ink2)" }}>
                    {bank._count?.questions ?? 0} question{bank._count?.questions === 1 ? "" : "s"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {editingId === bank.id ? (
                    <button
                      onClick={() => onSaveRename(bank.id)}
                      style={{ color: "var(--orange)", fontWeight: 700, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}
                    >
                      Save
                    </button>
                  ) : (
                    <Link href={`/admin/question-banks/${bank.id}`} style={{ color: "var(--orange)", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <EyeIcon /> View
                    </Link>
                  )}
                  <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                    <button
                      onClick={() => {
                        setEditingId(bank.id);
                        setEditingTitle(bank.title);
                      }}
                      title="Edit"
                      style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      <EditIcon />
                    </button>
                    <button
                      onClick={() => onDelete(bank.id)}
                      title="Delete"
                      style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      <TrashIcon />
                    </button>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
