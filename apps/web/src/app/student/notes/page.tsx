"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { facultyNotesApi, ApiError, type StudentNoteSets, type StudentNoteSet } from "@/lib/api";
import { NoteScopeChip, contextLine } from "@/components/NoteScopeChip";
import NoteSetViewer from "@/components/NoteSetViewer";

/**
 * Class Notes — ported from Design System/Student - Notes.dc.html (NT1/NT2/NT5m).
 *
 * The rule the whole screen is built around: one row per SET, never per page. A day's class
 * might be five photographed pages; that's one entry that opens into the paged reader, not
 * five rows. Previously this page listed every file separately and opened each in a new
 * browser tab.
 */

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "1px solid var(--line)",
  borderRadius: "var(--rs)",
  fontSize: 13.5,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

/** Stacked paper edge — the one place page-ness is decorative rather than counted. */
function PageStack({ set }: { set: StudentNoteSet }) {
  const cover = set.files[0];
  const multi = set.pageCount > 1;
  return (
    <div style={{ position: "relative", width: 74, height: 94, flex: "none" }}>
      {multi && (
        <>
          <div style={{ position: "absolute", left: 7, top: -5, width: 74, height: 94, borderRadius: 8, background: "#f3eee5", border: "1px solid #e3ddd4", transform: "rotate(2.6deg)" }} />
          <div style={{ position: "absolute", left: 3, top: -2, width: 74, height: 94, borderRadius: 8, background: "#fbf7f0", border: "1px solid #e6e0d7", transform: "rotate(1.2deg)" }} />
        </>
      )}
      <div style={{ position: "relative", width: 74, height: 94, borderRadius: 8, overflow: "hidden", background: "#fdfbf6", border: "1px solid #e6e0d7" }}>
        {cover?.kind === "IMAGE" ? (
          // Presigned R2 URLs expire in ~1h; next/image would cache them past their lifetime.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.fileUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--ink3)" }}>
            PDF
          </span>
        )}
      </div>
      {/* Sits on the paper corner: it describes the artefact, not the class. */}
      <span
        style={{
          position: "absolute", bottom: 5, left: 5, fontFamily: "var(--font-mono)", fontSize: 8.5,
          fontWeight: 700, letterSpacing: 0.7, borderRadius: 5, padding: "3px 6px",
          background: cover?.kind === "PDF" ? "#fff" : "rgba(28,25,21,.72)",
          color: cover?.kind === "PDF" ? "var(--ink)" : "#fff",
          border: cover?.kind === "PDF" ? "1px solid var(--line)" : "none",
        }}
      >
        {cover?.kind ?? "FILE"}
      </span>
    </div>
  );
}

function PageCountPill({ count }: { count: number }) {
  // A one-page set is just a note; saying "1 page" invites the reader to look for a second.
  if (count < 2) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "var(--ink2)", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 999, padding: "3px 8px", letterSpacing: 0.4 }}>
      <span style={{ display: "inline-flex", gap: 1.5 }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 3, height: 8, background: "var(--ink3)", borderRadius: 1 }} />)}
      </span>
      {count} pages
    </span>
  );
}

export default function StudentNotesPage() {
  const [data, setData] = useState<StudentNoteSets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<StudentNoteSet | null>(null);

  const [q, setQ] = useState("");
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback((params: Record<string, string>) => {
    setLoading(true);
    facultyNotesApi
      .mineSets(params)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load notes"))
      .finally(() => setLoading(false));
  }, []);

  const first = useRef(true);
  useEffect(() => {
    const params = { q, courseId, batchId, from, to };
    if (first.current) {
      first.current = false;
      load(params);
      return;
    }
    const t = setTimeout(() => load(params), 300);
    return () => clearTimeout(t);
  }, [q, courseId, batchId, from, to, load]);

  const filtersActive = Boolean(q || courseId || batchId || from || to);
  const sets = data?.sets ?? [];

  return (
    <main className="fade-in mobile-page-pad" style={{ padding: "30px 30px 60px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.7, marginBottom: 4 }}>Class Notes</div>
      <div style={{ fontSize: 13, color: "var(--ink3)", fontWeight: 600, marginBottom: 22 }}>
        Notes your faculty shared — one entry per class, opened in a paged reader.
      </div>

      <div className="mobile-stack-header" style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 380 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search note titles…" style={{ ...inputStyle, width: "100%", padding: "10px 40px 10px 14px", borderRadius: 999 }} />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="2" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
          <option value="">All courses</option>
          {(data?.courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
          <option value="">All batches</option>
          {(data?.batches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Class date from" style={{ ...inputStyle, cursor: "pointer" }} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Class date to" style={{ ...inputStyle, cursor: "pointer" }} />
        {filtersActive && (
          <button
            onClick={() => { setQ(""); setCourseId(""); setBatchId(""); setFrom(""); setTo(""); }}
            style={{ background: "none", border: "none", color: "var(--orange-deep)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            Clear
          </button>
        )}
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <div style={{ display: "grid", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="dash-skeleton" style={{ height: 118 }} />)}
        </div>
      ) : sets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--ink3)" }}>
          {/* Two different situations: a dead end to back out of, vs a waiting state. */}
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>
            {filtersActive ? "No notes match your filters" : "No notes shared yet"}
          </div>
          <div style={{ fontSize: 13 }}>
            {filtersActive ? "Try clearing the search or filters." : "When your faculty shares class notes, they'll appear here."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {sets.map((set) => {
            const ctx = contextLine(set);
            return (
              <button
                key={set.id}
                onClick={() => setOpen(set)}
                className="entity-card"
                style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: "16px 18px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "inherit", width: "100%" }}
              >
                <PageStack set={set} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{set.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
                    <NoteScopeChip scope={set.scope} />
                    {ctx && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink2)", background: "var(--bg-sunk)", borderRadius: 6, padding: "3px 8px" }}>{ctx}</span>
                    )}
                    {set.sessionDate && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink3)" }}>
                        CLASS OF {new Date(set.sessionDate).toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase()}
                      </span>
                    )}
                    <PageCountPill count={set.pageCount} />
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink3)", flex: "none" }}>›</span>
              </button>
            );
          })}
        </div>
      )}

      {open && <NoteSetViewer set={open} onClose={() => setOpen(null)} />}
    </main>
  );
}
