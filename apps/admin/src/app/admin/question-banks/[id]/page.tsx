"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { questionBanksApi, uploadsApi, ApiError, type QuestionBankTree, type Question, type QuestionType } from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import RichTextEditor from "@/components/RichTextEditor";
import { useConfirm } from "@/components/ConfirmProvider";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

const btnStyle: React.CSSProperties = {
  padding: "9px 16px",
  background: "var(--ink)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
};

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.8">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.8">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  );
}

const TYPE_LABEL: Record<QuestionType, string> = {
  MCQ: "Multiple choice",
  FILL_BLANK: "Fill in the blank",
  ESSAY: "Essay",
  TRUE_FALSE: "True / False",
};

function QuestionForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Question;
  onSubmit: (data: { type: QuestionType; prompt: string; options?: string[]; correctOption?: string; imageUrl?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [type, setType] = useState<QuestionType>(initial?.type ?? "MCQ");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [options, setOptions] = useState<string[]>(initial?.options.length ? initial.options : ["", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [fillAnswer, setFillAnswer] = useState(type === "FILL_BLANK" ? initial?.correctOption ?? "" : "");
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<"true" | "false">(
    initial?.correctOption === "false" ? "false" : "true",
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState(initial?.imageUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial?.type === "MCQ" && initial.correctOption) {
      const idx = initial.options.indexOf(initial.correctOption);
      if (idx >= 0) setCorrectIndex(idx);
    }
  }, [initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const imageUrl = imageFile ? await uploadsApi.uploadFile(imageFile) : existingImageUrl || undefined;
      if (type === "MCQ") {
        const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
        if (cleanOptions.length < 2) throw new Error("Add at least 2 options");
        await onSubmit({ type, prompt, options: cleanOptions, correctOption: cleanOptions[correctIndex] ?? cleanOptions[0], imageUrl });
      } else if (type === "TRUE_FALSE") {
        await onSubmit({ type, prompt, correctOption: trueFalseAnswer, imageUrl });
      } else if (type === "FILL_BLANK") {
        await onSubmit({ type, prompt, correctOption: fillAnswer, imageUrl });
      } else {
        await onSubmit({ type, prompt, imageUrl });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to save question");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
      <select value={type} onChange={(e) => setType(e.target.value as QuestionType)} style={inputStyle}>
        {Object.entries(TYPE_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Question prompt</div>
        <RichTextEditor value={prompt} onChange={setPrompt} />
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Attach image (optional)</div>
        {existingImageUrl && !imageFile && (
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <img src={existingImageUrl} alt="Attached" style={{ maxWidth: 160, maxHeight: 100, borderRadius: 8, border: "1px solid var(--line)" }} />
            <button type="button" onClick={() => setExistingImageUrl("")} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, cursor: "pointer" }}>
              Remove
            </button>
          </div>
        )}
        <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
      </div>

      {type === "MCQ" && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Options (select the correct one)</div>
          <div style={{ display: "grid", gap: 8 }}>
            {options.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="radio"
                  name="correctOption"
                  checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)}
                />
                <input
                  required
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
                  style={{ ...inputStyle, flex: 1 }}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOptions(options.filter((_, j) => j !== i));
                      if (correctIndex >= i && correctIndex > 0) setCorrectIndex(correctIndex - 1);
                    }}
                    style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 12 }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOptions([...options, ""])}
            style={{ marginTop: 8, background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
          >
            + Add option
          </button>
        </div>
      )}

      {type === "TRUE_FALSE" && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Correct answer</div>
          <div style={{ display: "flex", gap: 10 }}>
            {(["true", "false"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTrueFalseAnswer(v)}
                style={{
                  flex: 1,
                  padding: "9px 14px",
                  borderRadius: 10,
                  border: trueFalseAnswer === v ? "1px solid var(--ink)" : "1px solid var(--line)",
                  background: trueFalseAnswer === v ? "var(--ink)" : "var(--bg)",
                  color: trueFalseAnswer === v ? "#fff" : "var(--ink2)",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {v === "true" ? "True" : "False"}
              </button>
            ))}
          </div>
        </div>
      )}

      {type === "FILL_BLANK" && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Accepted answer</div>
          <input required value={fillAnswer} onChange={(e) => setFillAnswer(e.target.value)} style={inputStyle} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={busy}
          style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.7 : 1 }}
        >
          {busy && <Spinner />}
          {busy ? "Saving…" : initial ? "Save changes" : "Add question"}
        </button>
        <button type="button" onClick={onCancel} style={{ background: "none", border: "none", color: "var(--ink3)", fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
      {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
    </form>
  );
}

function QuestionAnswerSummary({ question }: { question: Question }) {
  if (question.type === "MCQ") {
    return (
      <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>
        {question.options.map((opt) => (
          <div key={opt} style={{ color: opt === question.correctOption ? "var(--green)" : "var(--ink2)", fontWeight: opt === question.correctOption ? 700 : 400 }}>
            {opt === question.correctOption ? "✓ " : "• "}
            {opt}
          </div>
        ))}
      </div>
    );
  }
  if (question.type === "TRUE_FALSE") {
    return <div style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 700 }}>Answer: {question.correctOption === "false" ? "False" : "True"}</div>;
  }
  if (question.type === "FILL_BLANK") {
    return <div style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 700 }}>Answer: {question.correctOption}</div>;
  }
  return <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>Freeform answer — ungraded</div>;
}

type ComprehensionQuestionDraft = { prompt: string; options: string[]; correctIndex: number; imageFile: File | null };

function ComprehensionForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: { passageText: string; passageImageUrl?: string; questions: { prompt: string; options: string[]; correctOption: string; imageUrl?: string }[] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [passageText, setPassageText] = useState("");
  const [passageImageFile, setPassageImageFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<ComprehensionQuestionDraft[]>(
    Array.from({ length: 6 }, () => ({ prompt: "", options: ["", "", "", ""], correctIndex: 0, imageFile: null })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(i: number, patch: Partial<ComprehensionQuestionDraft>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function updateOption(i: number, oi: number, value: string) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q)));
  }
  function addQuestionDraft() {
    setQuestions((qs) => [...qs, { prompt: "", options: ["", "", "", ""], correctIndex: 0, imageFile: null }]);
  }
  function removeQuestionDraft(i: number) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!passageText.trim()) throw new Error("Passage text is required");
      const cleanQuestions = questions.filter((q) => q.prompt.trim());
      if (cleanQuestions.length === 0) throw new Error("Add at least one question");
      for (const q of cleanQuestions) {
        if (q.options.filter((o) => o.trim()).length < 2) throw new Error("Each question needs at least 2 options");
      }
      const passageImageUrl = passageImageFile ? await uploadsApi.uploadFile(passageImageFile) : undefined;
      const builtQuestions = await Promise.all(
        cleanQuestions.map(async (q) => {
          const cleanOptions = q.options.map((o) => o.trim()).filter(Boolean);
          const imageUrl = q.imageFile ? await uploadsApi.uploadFile(q.imageFile) : undefined;
          return { prompt: q.prompt, options: cleanOptions, correctOption: cleanOptions[q.correctIndex] ?? cleanOptions[0], imageUrl };
        }),
      );
      await onSubmit({ passageText, passageImageUrl, questions: builtQuestions });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to save comprehension set");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Passage</div>
        <textarea
          required
          value={passageText}
          onChange={(e) => setPassageText(e.target.value)}
          placeholder="Paste or write the comprehension passage…"
          style={{ ...inputStyle, width: "100%", minHeight: 140, resize: "vertical", lineHeight: 1.6 }}
        />
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Passage image (optional)</div>
          <input type="file" accept="image/*" onChange={(e) => setPassageImageFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Questions ({questions.length})</div>
        <div style={{ display: "grid", gap: 12 }}>
          {questions.map((q, i) => (
            <div key={i} style={{ background: "var(--bg)", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", flex: "none" }}>Q{i + 1}</span>
                <input
                  value={q.prompt}
                  onChange={(e) => updateQuestion(i, { prompt: e.target.value })}
                  placeholder="Question prompt"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button type="button" onClick={() => removeQuestionDraft(i)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, cursor: "pointer", flex: "none" }}>
                  Remove
                </button>
              </div>
              <div style={{ display: "grid", gap: 6, paddingLeft: 20 }}>
                {q.options.map((opt, oi) => (
                  <div key={oi} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="radio" name={`correct-${i}`} checked={q.correctIndex === oi} onChange={() => updateQuestion(i, { correctIndex: oi })} />
                    <input
                      value={opt}
                      onChange={(e) => updateOption(i, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                      style={{ ...inputStyle, flex: 1, padding: "7px 10px", fontSize: 13 }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, paddingLeft: 20 }}>
                <input type="file" accept="image/*" onChange={(e) => updateQuestion(i, { imageFile: e.target.files?.[0] ?? null })} style={{ fontSize: 12 }} title="Attach image (optional)" />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addQuestionDraft}
          style={{ marginTop: 8, background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
        >
          + Add another question
        </button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 8, opacity: busy ? 0.7 : 1 }}>
          {busy && <Spinner />}
          {busy ? "Saving…" : "Create comprehension set"}
        </button>
        <button type="button" onClick={onCancel} style={{ background: "none", border: "none", color: "var(--ink3)", fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
      {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
    </form>
  );
}

export default function AdminQuestionBankDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const bankId = params.id;
  const confirm = useConfirm();

  const [bank, setBank] = useState<QuestionBankTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showComprehensionModal, setShowComprehensionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  function load() {
    setLoading(true);
    questionBanksApi
      .get(bankId)
      .then(setBank)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load question bank"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [bankId]);

  async function onTogglePublished() {
    if (!bank) return;
    const updated = await questionBanksApi.update(bank.id, { published: !bank.published });
    setBank({ ...bank, published: updated.published });
  }

  async function onSaveTitle() {
    if (!bank) return;
    await questionBanksApi.update(bank.id, { title: titleValue });
    setEditingTitle(false);
    load();
  }

  async function onDeleteBank() {
    if (!(await confirm({ message: "Delete this question bank and all its questions? This cannot be undone." }))) return;
    await questionBanksApi.remove(bankId);
    router.push("/admin/question-banks");
  }

  async function onAddQuestion(data: { type: QuestionType; prompt: string; options?: string[]; correctOption?: string; imageUrl?: string }) {
    await questionBanksApi.createQuestion(bankId, data);
    setShowAddModal(false);
    load();
  }

  async function onEditQuestion(data: { type: QuestionType; prompt: string; options?: string[]; correctOption?: string; imageUrl?: string }) {
    if (!editingQuestion) return;
    await questionBanksApi.updateQuestion(editingQuestion.id, {
      type: data.type,
      prompt: data.prompt,
      options: data.options ?? [],
      correctOption: data.correctOption,
      imageUrl: data.imageUrl ?? null,
    });
    setEditingQuestion(null);
    load();
  }

  async function onDeleteQuestion(id: string) {
    if (!(await confirm({ message: "Delete this question? This cannot be undone." }))) return;
    await questionBanksApi.removeQuestion(id);
    load();
  }

  async function onAddComprehension(data: { passageText: string; passageImageUrl?: string; questions: { prompt: string; options: string[]; correctOption: string; imageUrl?: string }[] }) {
    await questionBanksApi.createComprehension(bankId, data);
    setShowComprehensionModal(false);
    load();
  }

  if (loading) return <div style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></div>;
  if (error || !bank) return <div style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Question bank not found"}</p></div>;

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--orange)", textTransform: "uppercase", marginBottom: 4 }}>
            Question Bank
          </div>
          {editingTitle ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSaveTitle()}
                style={{ ...inputStyle, fontSize: 20, fontWeight: 800 }}
              />
              <button onClick={onSaveTitle} style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>
                Save
              </button>
            </div>
          ) : (
            <h1 style={{ fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
              {bank.title}
              <button
                onClick={() => {
                  setEditingTitle(true);
                  setTitleValue(bank.title);
                }}
                style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <EditIcon />
              </button>
            </h1>
          )}
        </div>
        <span style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onTogglePublished}
            style={{
              ...btnStyle,
              background: bank.published ? "var(--amber-soft)" : "var(--green-soft)",
              color: bank.published ? "var(--amber)" : "var(--green)",
            }}
          >
            {bank.published ? "Unpublish" : "Publish"}
          </button>
          <button onClick={onDeleteBank} style={{ ...btnStyle, background: "var(--red)", display: "flex", alignItems: "center", gap: 6 }}>
            <TrashIcon /> Delete bank
          </button>
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--ink3)" }}>
          {bank.questions.length} question{bank.questions.length === 1 ? "" : "s"}
        </div>
        <span style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowComprehensionModal(true)} style={{ ...btnStyle, background: "var(--purple-soft)", color: "var(--purple)", display: "flex", alignItems: "center", gap: 7 }}>
            <PlusIcon /> Add comprehension
          </button>
          <button onClick={() => setShowAddModal(true)} style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 7 }}>
            <PlusIcon /> Add question
          </button>
        </span>
      </div>

      {showAddModal && (
        <Modal title="Add question" onClose={() => setShowAddModal(false)} maxWidth={680}>
          <QuestionForm onSubmit={onAddQuestion} onCancel={() => setShowAddModal(false)} />
        </Modal>
      )}

      {showComprehensionModal && (
        <Modal title="Add comprehension passage" onClose={() => setShowComprehensionModal(false)} maxWidth={720}>
          <ComprehensionForm onSubmit={onAddComprehension} onCancel={() => setShowComprehensionModal(false)} />
        </Modal>
      )}

      {editingQuestion && (
        <Modal title="Edit question" onClose={() => setEditingQuestion(null)} maxWidth={680}>
          <QuestionForm initial={editingQuestion} onSubmit={onEditQuestion} onCancel={() => setEditingQuestion(null)} />
        </Modal>
      )}

      {bank.questions.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No questions yet — add the first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {bank.questions.map((question) => (
            <div key={question.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: 7,
                    background: "var(--purple-soft)",
                    color: "var(--purple)",
                  }}
                >
                  {TYPE_LABEL[question.type]}
                </span>
                <span style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setEditingQuestion(question)} title="Edit" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <EditIcon />
                  </button>
                  <button onClick={() => onDeleteQuestion(question.id)} title="Delete" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <TrashIcon />
                  </button>
                </span>
              </div>
              {question.passage && (
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--orange)", marginBottom: 6 }}>📖 Comprehension</div>
              )}
              {question.imageUrl && (
                <img src={question.imageUrl} alt="" style={{ width: "100%", maxHeight: 100, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
              )}
              <div
                style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, maxHeight: 80, overflow: "hidden" }}
                dangerouslySetInnerHTML={{ __html: question.prompt }}
              />
              <QuestionAnswerSummary question={question} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
