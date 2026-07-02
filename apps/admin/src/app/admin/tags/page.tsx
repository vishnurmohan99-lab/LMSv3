"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { tagsApi, ApiError, type Tag } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

const btn: React.CSSProperties = {
  padding: "7px 13px",
  borderRadius: 9,
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink2)",
};

function usage(t: Tag) {
  return (t._count?.questions ?? 0) + (t._count?.testQuestions ?? 0);
}

export default function AdminTagsPage() {
  const confirm = useConfirm();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");

  function load() {
    setLoading(true);
    tagsApi
      .list()
      .then((t) => {
        setTags(t);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load tags"))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setActionError(null);
    try {
      await tagsApi.create(name);
      setNewName("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to create tag");
    } finally {
      setCreating(false);
    }
  }

  async function onRename(id: string) {
    const name = editName.trim();
    if (!name) return;
    setBusyId(id);
    setActionError(null);
    try {
      await tagsApi.rename(id, name);
      setEditingId(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to rename tag");
    } finally {
      setBusyId(null);
    }
  }

  async function onMerge(id: string) {
    if (!mergeTarget) return;
    const src = tags.find((t) => t.id === id);
    const target = tags.find((t) => t.id === mergeTarget);
    if (!(await confirm({ message: `Merge "${src?.name}" into "${target?.name}"? All its questions move to "${target?.name}" and "${src?.name}" is deleted. This cannot be undone.` }))) return;
    setBusyId(id);
    setActionError(null);
    try {
      await tagsApi.merge(id, mergeTarget);
      setMergingId(null);
      setMergeTarget("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to merge tag");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(t: Tag) {
    const n = usage(t);
    const msg = n > 0
      ? `Delete "${t.name}"? It's used by ${n} question${n === 1 ? "" : "s"} — deleting removes the tag from ${n === 1 ? "it" : "them"} (the questions stay). This cannot be undone.`
      : `Delete "${t.name}"? This cannot be undone.`;
    if (!(await confirm({ message: msg }))) return;
    setBusyId(t.id);
    setActionError(null);
    try {
      await tagsApi.remove(t.id);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete tag");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px", maxWidth: 760, margin: "0 auto" }}>
      <Link href="/admin/tests" style={{ color: "var(--ink3)", fontSize: 13, fontWeight: 700 }}>
        ← Back to Tests
      </Link>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, margin: "14px 0 4px" }}>Manage Tags</div>
      <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 22 }}>
        Tags are shared across all question banks and tests. Rename to fix typos, merge duplicates together, or delete ones you no longer use.
      </p>

      <form onSubmit={onCreate} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New tag name" style={{ ...inputStyle, flex: 1 }} />
        <button type="submit" disabled={creating || !newName.trim()} style={{ ...btn, background: "var(--ink)", color: "#fff", border: "none", opacity: creating || !newName.trim() ? 0.6 : 1 }}>
          {creating ? "Adding…" : "Add tag"}
        </button>
      </form>

      {actionError && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{actionError}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--red)" }}>{error}</p>
      ) : tags.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No tags yet — add one above or tag a question in a question bank.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {tags.map((t) => {
            const n = usage(t);
            const isEditing = editingId === t.id;
            const isMerging = mergingId === t.id;
            const busy = busyId === t.id;
            return (
              <div key={t.id} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {isEditing ? (
                    <>
                      <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onRename(t.id)} style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
                      <button onClick={() => onRename(t.id)} disabled={busy || !editName.trim()} style={{ ...btn, background: "var(--orange)", color: "#fff", border: "none", opacity: busy || !editName.trim() ? 0.6 : 1 }}>
                        {busy ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ ...btn, background: "none", border: "none" }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 120 }}>{t.name}</span>
                      <span style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 600 }}>{n} use{n === 1 ? "" : "s"}</span>
                      <button onClick={() => { setEditingId(t.id); setEditName(t.name); setMergingId(null); }} style={btn}>
                        Rename
                      </button>
                      <button onClick={() => { setMergingId(isMerging ? null : t.id); setMergeTarget(""); setEditingId(null); }} disabled={tags.length < 2} style={{ ...btn, opacity: tags.length < 2 ? 0.5 : 1 }}>
                        Merge
                      </button>
                      <button onClick={() => onDelete(t)} disabled={busy} style={{ ...btn, color: "var(--red)", borderColor: "var(--red-soft)" }}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
                {isMerging && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, color: "var(--ink2)" }}>Merge into:</span>
                    <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }}>
                      <option value="">Select a tag…</option>
                      {tags.filter((x) => x.id !== t.id).map((x) => (
                        <option key={x.id} value={x.id}>{x.name}</option>
                      ))}
                    </select>
                    <button onClick={() => onMerge(t.id)} disabled={!mergeTarget || busy} style={{ ...btn, background: "var(--orange)", color: "#fff", border: "none", opacity: !mergeTarget || busy ? 0.6 : 1 }}>
                      {busy ? "Merging…" : "Merge"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
