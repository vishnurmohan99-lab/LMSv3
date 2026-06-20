"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { segmentsApi, uploadsApi, ApiError, type Segment } from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";

const BANNER_HEIGHT = 100;

function CardBanner({ url }: { url: string | null }) {
  return (
    <div
      style={{
        height: BANNER_HEIGHT,
        borderRadius: "var(--rm) var(--rm) 0 0",
        background: url ? `url(${url}) center/cover` : "var(--bg)",
        border: "1px solid var(--line)",
        borderBottom: "none",
      }}
    />
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

export default function AdminSegmentsPage() {
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [needsSubsegments, setNeedsSubsegments] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function load() {
    setLoading(true);
    segmentsApi
      .list()
      .then(setSegments)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load segments"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filteredSegments = useMemo(
    () => segments.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [segments, search],
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (needsSubsegments === null) return;
    setError(null);
    setCreating(true);
    try {
      const bannerUrl = bannerFile ? await uploadsApi.uploadFile(bannerFile) : undefined;
      const segment = await segmentsApi.create({ name, bannerUrl });
      setName("");
      setBannerFile(null);
      setNeedsSubsegments(null);
      setShowAddModal(false);
      if (needsSubsegments) {
        router.push(`/admin/segments/${segment.id}`);
      } else {
        load();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create segment");
    } finally {
      setCreating(false);
    }
  }

  async function onSaveRename(id: string) {
    try {
      await segmentsApi.update(id, { name: editingName });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to rename segment");
    }
  }

  async function onDeleteSegment(id: string) {
    try {
      await segmentsApi.remove(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete segment");
    }
  }

  return (
    <div style={{ padding: "30px 40px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Segments</div>
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
          Add segment
        </button>
      </div>

      {showAddModal && (
        <Modal title="Add segment" onClose={() => setShowAddModal(false)}>
          <form onSubmit={onCreate} style={{ display: "grid", gap: 14 }}>
            <input
              required
              autoFocus
              placeholder="Segment name (e.g. Competitive Exams)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>
                Banner image (optional)
              </div>
              <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>
                Does this segment need sub-segments?
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setNeedsSubsegments(true)}
                  style={{
                    flex: 1,
                    padding: "9px 14px",
                    borderRadius: 10,
                    border: needsSubsegments === true ? "1px solid var(--ink)" : "1px solid var(--line)",
                    background: needsSubsegments === true ? "var(--ink)" : "var(--bg)",
                    color: needsSubsegments === true ? "#fff" : "var(--ink2)",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  Yes, add sub-segments
                </button>
                <button
                  type="button"
                  onClick={() => setNeedsSubsegments(false)}
                  style={{
                    flex: 1,
                    padding: "9px 14px",
                    borderRadius: 10,
                    border: needsSubsegments === false ? "1px solid var(--ink)" : "1px solid var(--line)",
                    background: needsSubsegments === false ? "var(--ink)" : "var(--bg)",
                    color: needsSubsegments === false ? "#fff" : "var(--ink2)",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  No, add courses directly
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating || needsSubsegments === null}
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
                cursor: creating || needsSubsegments === null ? "default" : "pointer",
                opacity: creating || needsSubsegments === null ? 0.6 : 1,
              }}
            >
              {creating && <Spinner />}
              {creating ? "Creating…" : "Create segment"}
            </button>
          </form>
        </Modal>
      )}

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <input
        placeholder="Search segments…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputStyle, width: "100%", marginBottom: 16 }}
      />

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : filteredSegments.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No segments match.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {filteredSegments.map((segment) => (
            <div
              key={segment.id}
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rm)",
                overflow: "hidden",
              }}
            >
              <CardBanner url={segment.bannerUrl} />
              <div style={{ padding: 16 }}>
                {editingId === segment.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSaveRename(segment.id)}
                    style={{ ...inputStyle, padding: "6px 10px", marginBottom: 8 }}
                  />
                ) : (
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{segment.name}</div>
                )}
                <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 12 }}>
                  {segment.subsegments.length} sub-segment{segment.subsegments.length === 1 ? "" : "s"} ·{" "}
                  {segment._count?.courses ?? 0} course{segment._count?.courses === 1 ? "" : "s"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {editingId === segment.id ? (
                    <button
                      onClick={() => onSaveRename(segment.id)}
                      style={{ color: "var(--orange)", fontWeight: 700, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}
                    >
                      Save
                    </button>
                  ) : (
                    <Link href={`/admin/segments/${segment.id}`} style={{ color: "var(--orange)", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <EyeIcon /> View
                    </Link>
                  )}
                  <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                    <button
                      onClick={() => {
                        setEditingId(segment.id);
                        setEditingName(segment.name);
                      }}
                      title="Edit"
                      style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      <EditIcon />
                    </button>
                    <button
                      onClick={() => onDeleteSegment(segment.id)}
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
