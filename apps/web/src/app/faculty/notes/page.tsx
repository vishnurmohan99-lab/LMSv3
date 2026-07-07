"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { facultyNotesApi, batchesApi, ApiError, type NotesBank, type Batch } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  border: "1px solid var(--line)",
  borderRadius: "var(--rs)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

export default function FacultyNotesPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [banks, setBanks] = useState<NotesBank[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.allSettled([facultyNotesApi.listBanks(), batchesApi.listAll()])
      .then(([b, ba]) => {
        if (b.status === "fulfilled") setBanks(b.value);
        if (ba.status === "fulfilled") setBatches(ba.value);
        const failed = [b, ba].find((r) => r.status === "rejected");
        if (failed && failed.status === "rejected") setError(failed.reason instanceof ApiError ? failed.reason.message : "Failed to load notes banks");
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function toggleBatch(id: string) {
    setSelectedBatches((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function onCreate() {
    if (!title.trim()) {
      setModalError("Title is required");
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const bank = await facultyNotesApi.createBank({ title: title.trim(), batchIds: [...selectedBatches] });
      setShowModal(false);
      setTitle("");
      setSelectedBatches(new Set());
      router.push(`/faculty/notes/${bank.id}`);
    } catch (e) {
      setModalError(e instanceof ApiError ? e.message : "Failed to create notes bank");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(bank: NotesBank) {
    if (!(await confirm({ message: `Delete "${bank.title}" and all its notes? This cannot be undone.` }))) return;
    setError(null);
    try {
      await facultyNotesApi.removeBank(bank.id);
      setBanks((prev) => prev.filter((b) => b.id !== bank.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to delete");
    }
  }

  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Faculty Notes</div>
          <div style={{ fontSize: 13, color: "var(--ink3)", fontWeight: 600, marginTop: 2 }}>Notes banks shared with batches. Each note is a file tagged to a course + chapter.</div>
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: "10px 18px", background: "var(--orange)", color: "#fff", border: "none", borderRadius: "var(--rs)", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
          + New notes bank
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : banks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--ink3)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>No notes banks yet</div>
          <div style={{ fontSize: 13 }}>Create one and share it with a batch to get started.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {banks.map((bank) => (
            <div key={bank.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden" }}>
              <Link href={`/faculty/notes/${bank.id}`} style={{ display: "block", padding: 18, textDecoration: "none", color: "inherit" }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{bank.title}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {bank.batches.length === 0 ? (
                    <span style={{ fontSize: 11, color: "var(--amber)", fontWeight: 700, background: "var(--amber-soft)", padding: "3px 9px", borderRadius: 999 }}>No batch assigned</span>
                  ) : (
                    bank.batches.map((b) => (
                      <span key={b.batch.id} style={{ fontSize: 11, fontWeight: 700, color: "var(--purple-ink)", background: "var(--purple-soft)", padding: "3px 9px", borderRadius: 999 }}>{b.batch.name}</span>
                    ))
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", fontWeight: 600 }}>{bank._count?.notes ?? 0} note{(bank._count?.notes ?? 0) === 1 ? "" : "s"}</div>
              </Link>
              <div style={{ borderTop: "1px solid var(--line)", padding: "10px 18px", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => onDelete(bank)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,18,16,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} className="pop-in" style={{ background: "var(--card)", borderRadius: "var(--rl)", padding: 26, width: "100%", maxWidth: 480, boxShadow: "var(--e4)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>New notes bank</div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)", display: "block", marginBottom: 6 }}>Title</label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Class 12 Physics — Term 1 notes" style={{ ...inputStyle, marginBottom: 18 }} />
            <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)", display: "block", marginBottom: 8 }}>Share with batches</label>
            <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto", marginBottom: 18 }}>
              {batches.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--ink3)" }}>No batches exist yet.</div>
              ) : (
                batches.map((b) => (
                  <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "var(--rs)", cursor: "pointer", fontSize: 13.5 }}>
                    <input type="checkbox" checked={selectedBatches.has(b.id)} onChange={() => toggleBatch(b.id)} style={{ width: 16, height: 16, accentColor: "var(--orange)" }} />
                    {b.name}
                  </label>
                ))
              )}
            </div>
            {modalError && <p style={{ color: "var(--red)", fontSize: 12.5, marginBottom: 12 }}>{modalError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "10px 16px", background: "transparent", border: "1px solid var(--line)", borderRadius: "var(--rs)", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", color: "var(--ink2)" }}>Cancel</button>
              <button onClick={onCreate} disabled={saving} style={{ padding: "10px 18px", background: "var(--orange)", color: "#fff", border: "none", borderRadius: "var(--rs)", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "Creating…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
