"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { facultyNotesApi, batchesApi, coursesApi, ApiError, type NotesBank, type Batch, type Course, type NoteScope, type NotesBankFilters } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";
import NotesScopeFields, { ScopeChip, SCOPES, emptyScope, toScopeInput, validateScope, type ScopeState } from "@/components/NotesScopeFields";

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

const filterStyle: React.CSSProperties = { ...inputStyle, width: "auto", padding: "9px 12px", fontSize: 13, cursor: "pointer" };

/** What a bank targets, in one line, for the card. */
function targetLabel(bank: NotesBank): string {
  if (bank.scope === "GENERAL") return "All students";
  if (bank.scope === "COURSE") return bank.course?.title ?? "Course";
  if (bank.scope === "LESSON") return [bank.course?.title, bank.lesson?.title].filter(Boolean).join(" · ") || "Lesson";
  return bank.batches.map((b) => b.batch.name).join(", ");
}

export default function FacultyNotesPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [banks, setBanks] = useState<NotesBank[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters (F10) — the list previously had no search at all, which stops scaling the moment
  // a faculty member is two terms in.
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<NoteScope | "">("");
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [scopeState, setScopeState] = useState<ScopeState>(emptyScope);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadBanks = useCallback((filters: NotesBankFilters) => {
    setLoading(true);
    facultyNotesApi
      .listBanks(filters)
      .then(setBanks)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load notes banks"))
      .finally(() => setLoading(false));
  }, []);

  // Facets load once; they must not shrink as the list narrows.
  useEffect(() => {
    Promise.allSettled([batchesApi.listAll(), coursesApi.list()]).then(([ba, co]) => {
      if (ba.status === "fulfilled") setBatches(ba.value);
      if (co.status === "fulfilled") setCourses(co.value);
    });
  }, []);

  // Debounced so typing a title doesn't fire a request per keystroke.
  const first = useRef(true);
  useEffect(() => {
    const filters = { q, scope: scope || undefined, courseId, batchId, from, to } as NotesBankFilters;
    if (first.current) {
      first.current = false;
      loadBanks(filters);
      return;
    }
    const t = setTimeout(() => loadBanks(filters), 300);
    return () => clearTimeout(t);
  }, [q, scope, courseId, batchId, from, to, loadBanks]);

  const filtersActive = Boolean(q || scope || courseId || batchId || from || to);
  function clearFilters() {
    setQ(""); setScope(""); setCourseId(""); setBatchId(""); setFrom(""); setTo("");
  }

  async function onCreate() {
    if (!title.trim()) {
      setModalError("Title is required");
      return;
    }
    const scopeError = validateScope(scopeState);
    if (scopeError) {
      setModalError(scopeError);
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const bank = await facultyNotesApi.createBank({ title: title.trim(), ...toScopeInput(scopeState) });
      setShowModal(false);
      setTitle("");
      setScopeState(emptyScope());
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
          <div style={{ fontSize: 13, color: "var(--ink3)", fontWeight: 600, marginTop: 2 }}>
            Note sets shared with students. Each set targets everyone, a course, batches, or one lesson.
          </div>
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: "10px 18px", background: "var(--orange)", color: "#fff", border: "none", borderRadius: "var(--rs)", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
          + New notes bank
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title…" style={{ ...filterStyle, width: 240, cursor: "text", borderRadius: 999 }} />
        <select value={scope} onChange={(e) => setScope(e.target.value as NoteScope | "")} style={filterStyle}>
          <option value="">All scopes</option>
          {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={filterStyle}>
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)} style={filterStyle}>
          <option value="">All batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Class date from" style={filterStyle} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Class date to" style={filterStyle} />
        {filtersActive && (
          <button onClick={clearFilters} style={{ background: "none", border: "none", color: "var(--orange-deep)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Clear
          </button>
        )}
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : banks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--ink3)" }}>
          {/* "Nothing matches" is a dead end to back out of; "nothing yet" is a waiting state. */}
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>
            {filtersActive ? "No notes banks match your filters" : "No notes banks yet"}
          </div>
          <div style={{ fontSize: 13 }}>
            {filtersActive ? "Try clearing the search or filters." : "Create one and choose who sees it to get started."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {banks.map((bank) => (
            <div key={bank.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden" }}>
              <Link href={`/faculty/notes/${bank.id}`} style={{ display: "block", padding: 18, textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <ScopeChip scope={bank.scope} />
                  {!bank.published && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber-ink)", background: "var(--amber-soft)", padding: "3px 9px", borderRadius: 999 }}>Draft</span>
                  )}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{bank.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink2)", fontWeight: 600, marginBottom: 10 }}>{targetLabel(bank)}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", fontWeight: 600, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span>{bank._count?.notes ?? 0} note{(bank._count?.notes ?? 0) === 1 ? "" : "s"}</span>
                  {bank.sessionDate && <span>· Class of {new Date(bank.sessionDate).toLocaleDateString()}</span>}
                </div>
              </Link>
              <div style={{ borderTop: "1px solid var(--line)", padding: "10px 18px", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => onDelete(bank)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,18,16,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} className="pop-in" style={{ background: "var(--card)", borderRadius: "var(--rl)", padding: 26, width: "100%", maxWidth: 480, boxShadow: "var(--e4)", maxHeight: "calc(100vh - 40px)", overflowY: "auto" }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>New notes bank</div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)", display: "block", marginBottom: 6 }}>Title</label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Thermodynamics — Ch 4, Part 2" style={{ ...inputStyle, marginBottom: 18 }} />
            <NotesScopeFields value={scopeState} onChange={setScopeState} batches={batches} />
            {modalError && <p style={{ color: "var(--red)", fontSize: 12.5, margin: "14px 0 0" }}>{modalError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "10px 16px", background: "transparent", border: "1px solid var(--line)", borderRadius: "var(--rs)", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", color: "var(--ink2)" }}>Cancel</button>
              <button onClick={onCreate} disabled={saving} style={{ padding: "10px 18px", background: "var(--orange)", color: "#fff", border: "none", borderRadius: "var(--rs)", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "Creating…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
