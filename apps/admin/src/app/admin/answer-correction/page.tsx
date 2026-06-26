"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  answerQuestionTypesApi,
  answerQuestionsApi,
  ApiError,
  type AnswerQuestionType,
  type AnswerQuestion,
} from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import { useConfirm } from "@/components/ConfirmProvider";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
};

const btnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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
};

type PartDraft = { partKey: string; name: string; defaultWeight: number };

function emptyPart(): PartDraft {
  return { partKey: "", name: "", defaultWeight: 0 };
}

function TypeFormModal({ initial, onClose, onSaved }: { initial: AnswerQuestionType | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [parts, setParts] = useState<PartDraft[]>(
    initial ? initial.parts.map((p) => ({ partKey: p.partKey, name: p.name, defaultWeight: p.defaultWeight })) : [emptyPart()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weightSum = parts.reduce((s, p) => s + (Number(p.defaultWeight) || 0), 0);
  const reconciled = Math.abs(weightSum - 1) < 0.01;

  function updatePart(i: number, patch: Partial<PartDraft>) {
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reconciled) {
      setError(`Default weights must sum to 100% (currently ${Math.round(weightSum * 100)}%)`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { name, parts: parts.map((p, i) => ({ partKey: p.partKey, name: p.name, order: i, defaultWeight: Number(p.defaultWeight) })) };
      if (initial) {
        await answerQuestionTypesApi.update(initial.id, payload);
      } else {
        await answerQuestionTypesApi.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save question type");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "Edit question type" : "New question type"} onClose={onClose} maxWidth={560}>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <input required autoFocus placeholder="Type name (e.g. GS Analytical)" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Parts</div>
          <div style={{ display: "grid", gap: 8 }}>
            {parts.map((part, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 90px 30px", gap: 8 }}>
                <input
                  required
                  placeholder="key (intro)"
                  value={part.partKey}
                  onChange={(e) => updatePart(i, { partKey: e.target.value })}
                  style={{ ...inputStyle, padding: "8px 10px" }}
                />
                <input
                  required
                  placeholder="Name"
                  value={part.name}
                  onChange={(e) => updatePart(i, { name: e.target.value })}
                  style={{ ...inputStyle, padding: "8px 10px" }}
                />
                <input
                  required
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  placeholder="weight"
                  value={part.defaultWeight}
                  onChange={(e) => updatePart(i, { defaultWeight: Number(e.target.value) })}
                  style={{ ...inputStyle, padding: "8px 10px" }}
                />
                <button
                  type="button"
                  onClick={() => setParts((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={parts.length === 1}
                  style={{ background: "none", border: "none", color: "var(--red)", cursor: parts.length === 1 ? "default" : "pointer", opacity: parts.length === 1 ? 0.4 : 1 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setParts((prev) => [...prev, emptyPart()])}
            style={{ marginTop: 8, background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            + Add part
          </button>
        </div>

        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            padding: "8px 12px",
            borderRadius: 8,
            background: reconciled ? "var(--green-soft)" : "var(--red-soft)",
            color: reconciled ? "var(--green)" : "var(--red)",
          }}
        >
          {reconciled ? "✓" : "✗"} Weights sum to {Math.round(weightSum * 100)}%
        </div>

        {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}

        <button type="submit" disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}>
          {saving && <Spinner />}
          {saving ? "Saving…" : "Save question type"}
        </button>
      </form>
    </Modal>
  );
}

export default function AnswerCorrectionPage() {
  const confirm = useConfirm();
  const [types, setTypes] = useState<AnswerQuestionType[]>([]);
  const [questions, setQuestions] = useState<AnswerQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeModal, setTypeModal] = useState<{ open: boolean; editing: AnswerQuestionType | null }>({ open: false, editing: null });

  function load() {
    setLoading(true);
    Promise.all([answerQuestionTypesApi.list(), answerQuestionsApi.list()])
      .then(([t, q]) => {
        setTypes(t);
        setQuestions(q);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function onDeleteType(id: string) {
    if (!(await confirm({ message: "Delete this question type? This cannot be undone." }))) return;
    try {
      await answerQuestionTypesApi.remove(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete question type");
    }
  }

  async function onDeleteQuestion(id: string) {
    if (!(await confirm({ message: "Delete this question and its rubric? This cannot be undone." }))) return;
    try {
      await answerQuestionsApi.remove(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete question");
    }
  }

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Answer Correction</div>
        <Link href="/admin/answer-correction/submissions" style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
          Grading queue →
        </Link>
      </div>
      <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 28 }}>
        AI-graded descriptive answers: define question types and rubric-backed questions, then students/faculty can upload a handwritten
        answer photo and get an automatic evaluation.
      </p>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Question Types</div>
        <button onClick={() => setTypeModal({ open: true, editing: null })} style={{ ...btnStyle, padding: "8px 14px", fontSize: 13 }}>
          + New type
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14, marginBottom: 32 }}>
          {types.map((t) => (
            <div key={t.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{t.name}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {t.parts.map((p) => (
                  <span key={p.id} style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 7, background: "var(--purple-soft)", color: "var(--purple)" }}>
                    {p.name} {Math.round(p.defaultWeight * 100)}%
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--ink2)" }}>{t._count?.questions ?? 0} question(s)</span>
                <span style={{ display: "inline-flex", gap: 10 }}>
                  <button onClick={() => setTypeModal({ open: true, editing: t })} style={{ background: "none", border: "none", color: "var(--ink2)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    Edit
                  </button>
                  <button onClick={() => onDeleteType(t.id)} style={{ background: "none", border: "none", color: "var(--red)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    Delete
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Questions</div>
        <Link href="/admin/answer-correction/questions/new" style={{ ...btnStyle, textDecoration: "none" }}>
          + New question
        </Link>
      </div>

      {!loading && questions.length === 0 && <p style={{ color: "var(--ink2)" }}>No questions yet.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {questions.map((q) => (
          <div key={q.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: 7,
                  background: q.published ? "var(--green-soft)" : "var(--amber-soft)",
                  color: q.published ? "var(--green)" : "var(--amber)",
                }}
              >
                {q.published ? "Published" : "Draft"}
              </span>
              <span style={{ fontSize: 12, color: "var(--ink2)" }}>{q.maxMarks} marks</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {q.text}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Link href={`/admin/answer-correction/questions/${q.id}`} style={{ color: "var(--orange)", fontWeight: 700, fontSize: 12 }}>
                Edit rubric
              </Link>
              <button onClick={() => onDeleteQuestion(q.id)} style={{ background: "none", border: "none", color: "var(--red)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {typeModal.open && (
        <TypeFormModal initial={typeModal.editing} onClose={() => setTypeModal({ open: false, editing: null })} onSaved={load} />
      )}
    </div>
  );
}
