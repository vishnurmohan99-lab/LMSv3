"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { facultyNotesApi, coursesApi, batchesApi, uploadsApi, ApiError, type NotesBankTree, type Note, type Course, type Batch, type Chapter } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid var(--line)",
  borderRadius: "var(--rs)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--ink2)", display: "block", marginBottom: 6 };

export default function AdminNotesBankDetailPage() {
  const params = useParams<{ id: string }>();
  const bankId = params.id;
  const router = useRouter();
  const confirm = useConfirm();

  const [bank, setBank] = useState<NotesBankTree | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add-note form
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);

  // Edit-bank modal
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBatches, setEditBatches] = useState<Set<string>>(new Set());
  const [savingBank, setSavingBank] = useState(false);

  function refresh() {
    return facultyNotesApi.getBank(bankId).then(setBank).catch((e) => setActionError(e instanceof ApiError ? e.message : "Failed to refresh"));
  }

  useEffect(() => {
    Promise.allSettled([facultyNotesApi.getBank(bankId), coursesApi.list(), batchesApi.listAll()])
      .then(([b, c, ba]) => {
        if (b.status === "fulfilled") setBank(b.value);
        else setError(b.reason instanceof ApiError ? b.reason.message : "Failed to load notes bank");
        if (c.status === "fulfilled") setCourses(c.value);
        if (ba.status === "fulfilled") setBatches(ba.value);
      })
      .finally(() => setLoading(false));
  }, [bankId]);

  async function onCourseChange(id: string) {
    setCourseId(id);
    setChapterId("");
    setChapters([]);
    if (!id) return;
    try {
      const tree = await coursesApi.get(id);
      setChapters(tree.chapters);
    } catch {
      /* leave chapters empty */
    }
  }

  async function onAddNote() {
    if (!name.trim() || !courseId || !file) {
      setActionError("Name, course, and a file are required.");
      return;
    }
    setAdding(true);
    setActionError(null);
    try {
      const key = await uploadsApi.uploadFile(file);
      await facultyNotesApi.createNote(bankId, { name: name.trim(), fileUrl: key, fileName: file.name, courseId, chapterId: chapterId || undefined });
      setName("");
      setCourseId("");
      setChapterId("");
      setChapters([]);
      setFile(null);
      await refresh();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to add note");
    } finally {
      setAdding(false);
    }
  }

  async function onDeleteNote(note: Note) {
    if (!(await confirm({ message: `Delete note "${note.name}"?` }))) return;
    setActionError(null);
    try {
      await facultyNotesApi.removeNote(note.id);
      await refresh();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to delete note");
    }
  }

  function openEdit() {
    if (!bank) return;
    setEditTitle(bank.title);
    setEditBatches(new Set(bank.batches.map((b) => b.batch.id)));
    setShowEdit(true);
  }

  async function onSaveBank() {
    if (!editTitle.trim()) return;
    setSavingBank(true);
    setActionError(null);
    try {
      await facultyNotesApi.updateBank(bankId, { title: editTitle.trim(), batchIds: [...editBatches] });
      setShowEdit(false);
      await refresh();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSavingBank(false);
    }
  }

  async function onDeleteBank() {
    if (!bank) return;
    if (!(await confirm({ message: `Delete "${bank.title}" and all its notes? This cannot be undone.` }))) return;
    try {
      await facultyNotesApi.removeBank(bankId);
      router.push("/admin/notes");
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to delete");
    }
  }

  if (loading) return <main style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></main>;
  if (error || !bank) return <main style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Notes bank not found"}</p></main>;

  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <Link href="/admin/notes" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink3)" }}>← Faculty Notes</Link>
      {actionError && <p style={{ color: "var(--red)", fontSize: 13, margin: "12px 0" }}>{actionError}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, margin: "10px 0 24px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--orange)", textTransform: "uppercase", marginBottom: 4 }}>Notes Bank</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{bank.title}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {bank.batches.length === 0 ? (
              <span style={{ fontSize: 11, color: "var(--amber)", fontWeight: 700, background: "var(--amber-soft)", padding: "3px 9px", borderRadius: 999 }}>No batch assigned</span>
            ) : (
              bank.batches.map((b) => (
                <span key={b.batch.id} style={{ fontSize: 11, fontWeight: 700, color: "var(--purple-ink)", background: "var(--purple-soft)", padding: "3px 9px", borderRadius: 999 }}>{b.batch.name}</span>
              ))
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={openEdit} style={{ padding: "9px 16px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rs)", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>Edit</button>
          <button onClick={onDeleteBank} style={{ padding: "9px 16px", background: "var(--red)", color: "#fff", border: "none", borderRadius: "var(--rs)", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>Delete</button>
        </div>
      </div>

      {/* Add note */}
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 20, marginBottom: 26 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>Add a note</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={label}>Note name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kinematics — summary sheet" style={inputStyle} />
          </div>
          <div>
            <label style={label}>Course</label>
            <select value={courseId} onChange={(e) => onCourseChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">Select course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Chapter (optional)</label>
            <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} disabled={!courseId || chapters.length === 0} style={{ ...inputStyle, cursor: "pointer", opacity: !courseId || chapters.length === 0 ? 0.5 : 1 }}>
              <option value="">{courseId ? "Whole course" : "Select course first"}</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={label}>File (PDF / image)</label>
            <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13, fontFamily: "inherit" }} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button onClick={onAddNote} disabled={adding} style={{ padding: "10px 20px", background: "var(--orange)", color: "#fff", border: "none", borderRadius: "var(--rs)", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: adding ? "default" : "pointer", opacity: adding ? 0.7 : 1 }}>
            {adding ? "Uploading…" : "Add note"}
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Notes ({bank.notes.length})</div>
      {bank.notes.length === 0 ? (
        <p style={{ color: "var(--ink3)", fontSize: 13.5 }}>No notes yet — add one above.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {bank.notes.map((n) => (
            <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: "12px 16px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{n.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "var(--purple-ink)", background: "var(--purple-soft)", padding: "2px 8px", borderRadius: 999 }}>{n.course.title}</span>
                  {n.chapter && <span style={{ fontWeight: 600, color: "var(--ink2)", background: "var(--bg-sunk)", padding: "2px 8px", borderRadius: 999 }}>{n.chapter.title}</span>}
                  {n.fileName && <span style={{ color: "var(--ink3)" }}>{n.fileName}</span>}
                </div>
              </div>
              <a href={n.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--orange-deep)" }}>Open</a>
              <button onClick={() => onDeleteNote(n)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {showEdit && (
        <div onClick={() => setShowEdit(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,18,16,.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} className="pop-in" style={{ background: "var(--card)", borderRadius: "var(--rl)", padding: 26, width: "100%", maxWidth: 480, boxShadow: "var(--e4)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Edit notes bank</div>
            <label style={label}>Title</label>
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ ...inputStyle, marginBottom: 18 }} />
            <label style={label}>Share with batches</label>
            <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto", marginBottom: 18 }}>
              {batches.map((b) => (
                <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "var(--rs)", cursor: "pointer", fontSize: 13.5 }}>
                  <input
                    type="checkbox"
                    checked={editBatches.has(b.id)}
                    onChange={() =>
                      setEditBatches((prev) => {
                        const next = new Set(prev);
                        next.has(b.id) ? next.delete(b.id) : next.add(b.id);
                        return next;
                      })
                    }
                    style={{ width: 16, height: 16, accentColor: "var(--orange)" }}
                  />
                  {b.name}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowEdit(false)} style={{ padding: "10px 16px", background: "transparent", border: "1px solid var(--line)", borderRadius: "var(--rs)", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", color: "var(--ink2)" }}>Cancel</button>
              <button onClick={onSaveBank} disabled={savingBank} style={{ padding: "10px 18px", background: "var(--orange)", color: "#fff", border: "none", borderRadius: "var(--rs)", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: savingBank ? "default" : "pointer", opacity: savingBank ? 0.7 : 1 }}>{savingBank ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
