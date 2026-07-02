"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { questionBanksApi, uploadsApi, ApiError, type QuestionBankTree, type Question, type QuestionType } from "@/lib/api";
import RichTextEditor from "@/components/RichTextEditor";
import QuestionMetaFields, { emptyQuestionMeta, type QuestionMetaValue } from "@/components/QuestionMetaFields";
import QuestionMetaBadges from "@/components/QuestionMetaBadges";
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
  onSubmit: (data: { type: QuestionType; prompt: string; options?: string[]; correctOption?: string; imageUrl?: string } & QuestionMetaValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [type, setType] = useState<QuestionType>(initial?.type ?? "MCQ");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [options, setOptions] = useState<string[]>(initial?.options.length ? initial.options : ["", ""]);
  const [correctIndex, setCorrectIndex] = useState(() => {
    if (initial?.type === "MCQ" && initial.correctOption) {
      const idx = initial.options.indexOf(initial.correctOption);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const [fillAnswer, setFillAnswer] = useState(initial?.type === "FILL_BLANK" ? initial?.correctOption ?? "" : "");
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<"true" | "false">(
    initial?.correctOption === "false" ? "false" : "true",
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState(initial?.imageUrl ?? "");
  const [meta, setMeta] = useState<QuestionMetaValue>(
    initial
      ? {
          difficulty: initial.difficulty,
          marks: initial.marks,
          negativeMarks: initial.negativeMarks,
          answerTimeSeconds: initial.answerTimeSeconds,
          tags: (initial.tags ?? []).map((t) => t.name),
        }
      : emptyQuestionMeta(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const imageUrl = imageFile ? await uploadsApi.uploadFile(imageFile) : existingImageUrl || undefined;
      if (type === "MCQ") {
        const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
        if (cleanOptions.length < 2) throw new Error("Add at least 2 options");
        await onSubmit({ type, prompt, options: cleanOptions, correctOption: cleanOptions[correctIndex] ?? cleanOptions[0], imageUrl, ...meta });
      } else if (type === "TRUE_FALSE") {
        await onSubmit({ type, prompt, correctOption: trueFalseAnswer, imageUrl, ...meta });
      } else if (type === "FILL_BLANK") {
        await onSubmit({ type, prompt, correctOption: fillAnswer, imageUrl, ...meta });
      } else {
        await onSubmit({ type, prompt, imageUrl, ...meta });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to save question");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: 14, marginBottom: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16 }}
    >
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
                <input type="radio" name="correctOption" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} />
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

      <QuestionMetaFields value={meta} onChange={setMeta} />

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.7 : 1 }}>
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

type QuestionGroup = { kind: "single"; question: Question } | { kind: "comprehension"; passage: NonNullable<Question["passage"]>; questions: Question[] };

function groupQuestions(questions: Question[]): QuestionGroup[] {
  const groups: QuestionGroup[] = [];
  const passageGroups = new Map<string, QuestionGroup & { kind: "comprehension" }>();
  for (const q of questions) {
    if (q.passageId && q.passage) {
      let group = passageGroups.get(q.passageId);
      if (!group) {
        group = { kind: "comprehension", passage: q.passage, questions: [] };
        passageGroups.set(q.passageId, group);
        groups.push(group);
      }
      group.questions.push(q);
    } else {
      groups.push({ kind: "single", question: q });
    }
  }
  return groups;
}

/** Letters a comprehension sub-question relative to its passage, e.g. passage 1's 3rd question -> "1-c". */
function subQuestionLabel(passageNumber: number, index: number): string {
  return `${passageNumber}-${String.fromCharCode(97 + index)}`;
}

function ComprehensionGroupCard({
  passageNumber,
  passage,
  questions,
  onEdit,
  onDelete,
}: {
  passageNumber: number;
  passage: NonNullable<Question["passage"]>;
  questions: Question[];
  onEdit: (q: Question) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className="entity-card"
      style={{ gridColumn: "1 / -1", background: "var(--card)", border: "1px solid var(--purple)", borderRadius: "var(--rl)", padding: 20 }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--purple)", textTransform: "uppercase", marginBottom: 10 }}>
        📖 Comprehension passage {passageNumber} · {questions.length} question{questions.length === 1 ? "" : "s"}
      </div>
      {passage.imageUrl && <img src={passage.imageUrl} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, marginBottom: 12 }} />}
      <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--ink2)", background: "var(--bg)", borderRadius: 10, padding: 14, marginBottom: 16, whiteSpace: "pre-wrap" }}>
        {passage.text}
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {questions.map((question, i) => (
          <div key={question.id} style={{ background: "var(--bg)", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)" }}>Question {subQuestionLabel(passageNumber, i)}</span>
              <span style={{ display: "flex", gap: 12 }}>
                <button onClick={() => onEdit(question)} style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  Edit
                </button>
                <button onClick={() => onDelete(question.id)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, cursor: "pointer" }}>
                  Remove
                </button>
              </span>
            </div>
            {question.imageUrl && <img src={question.imageUrl} alt="" style={{ width: "100%", maxHeight: 100, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />}
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: question.prompt }} />
            <QuestionAnswerSummary question={question} />
          </div>
        ))}
      </div>
    </div>
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

type ComprehensionQuestionType = "MCQ" | "FILL_BLANK" | "TRUE_FALSE";

const COMPREHENSION_TYPE_LABEL: Record<ComprehensionQuestionType, string> = {
  MCQ: "Multiple choice",
  FILL_BLANK: "Fill in the blank",
  TRUE_FALSE: "True / False",
};

type ComprehensionQuestionDraft = {
  type: ComprehensionQuestionType;
  prompt: string;
  options: string[];
  correctIndex: number;
  blankAnswer: string;
  trueFalseAnswer: "true" | "false";
  imageFile: File | null;
};

function newComprehensionDraft(): ComprehensionQuestionDraft {
  return { type: "MCQ", prompt: "", options: ["", "", "", ""], correctIndex: 0, blankAnswer: "", trueFalseAnswer: "true", imageFile: null };
}

function ComprehensionForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: {
    passageText: string;
    passageImageUrl?: string;
    questions: { type: ComprehensionQuestionType; prompt: string; options?: string[]; correctOption: string; imageUrl?: string }[];
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [passageText, setPassageText] = useState("");
  const [passageImageFile, setPassageImageFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<ComprehensionQuestionDraft[]>(Array.from({ length: 6 }, newComprehensionDraft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(i: number, patch: Partial<ComprehensionQuestionDraft>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function updateOption(i: number, oi: number, value: string) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q)));
  }
  function addQuestionDraft() {
    setQuestions((qs) => [...qs, newComprehensionDraft()]);
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
        if (q.type === "MCQ" && q.options.filter((o) => o.trim()).length < 2) {
          throw new Error("Each multiple-choice question needs at least 2 options");
        }
        if (q.type === "FILL_BLANK" && !q.blankAnswer.trim()) {
          throw new Error("Each fill-in-the-blank question needs an accepted answer");
        }
      }
      const passageImageUrl = passageImageFile ? await uploadsApi.uploadFile(passageImageFile) : undefined;
      const builtQuestions = await Promise.all(
        cleanQuestions.map(async (q) => {
          const imageUrl = q.imageFile ? await uploadsApi.uploadFile(q.imageFile) : undefined;
          if (q.type === "MCQ") {
            const cleanOptions = q.options.map((o) => o.trim()).filter(Boolean);
            return { type: q.type, prompt: q.prompt, options: cleanOptions, correctOption: cleanOptions[q.correctIndex] ?? cleanOptions[0], imageUrl };
          }
          if (q.type === "TRUE_FALSE") {
            return { type: q.type, prompt: q.prompt, correctOption: q.trueFalseAnswer, imageUrl };
          }
          return { type: q.type, prompt: q.prompt, correctOption: q.blankAnswer.trim(), imageUrl };
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
    <form
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: 16, marginBottom: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16, maxHeight: "70vh", overflowY: "auto" }}
    >
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
                <select
                  value={q.type}
                  onChange={(e) => updateQuestion(i, { type: e.target.value as ComprehensionQuestionType })}
                  style={{ ...inputStyle, flex: "none", width: 150, padding: "7px 8px", fontSize: 12.5 }}
                >
                  {Object.entries(COMPREHENSION_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => removeQuestionDraft(i)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, cursor: "pointer", flex: "none" }}>
                  Remove
                </button>
              </div>

              {q.type === "MCQ" && (
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
              )}

              {q.type === "TRUE_FALSE" && (
                <div style={{ display: "flex", gap: 10, paddingLeft: 20 }}>
                  {(["true", "false"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => updateQuestion(i, { trueFalseAnswer: v })}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 9,
                        border: q.trueFalseAnswer === v ? "1px solid var(--ink)" : "1px solid var(--line)",
                        background: q.trueFalseAnswer === v ? "var(--ink)" : "var(--card)",
                        color: q.trueFalseAnswer === v ? "#fff" : "var(--ink2)",
                        fontSize: 12.5,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      {v === "true" ? "True" : "False"}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "FILL_BLANK" && (
                <div style={{ paddingLeft: 20 }}>
                  <input
                    value={q.blankAnswer}
                    onChange={(e) => updateQuestion(i, { blankAnswer: e.target.value })}
                    placeholder="Accepted answer"
                    style={{ ...inputStyle, width: "100%", padding: "7px 10px", fontSize: 13 }}
                  />
                </div>
              )}

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
        <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.7 : 1 }}>
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

export default function FacultyQuestionBankDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const bankId = params.id;
  const confirm = useConfirm();

  const [bank, setBank] = useState<QuestionBankTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showComprehensionForm, setShowComprehensionForm] = useState(false);
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
    router.push("/faculty/question-banks");
  }

  async function onAddQuestion(data: { type: QuestionType; prompt: string; options?: string[]; correctOption?: string; imageUrl?: string }) {
    await questionBanksApi.createQuestion(bankId, data);
    setShowAddForm(false);
    load();
  }

  async function onEditQuestion(data: { type: QuestionType; prompt: string; options?: string[]; correctOption?: string; imageUrl?: string } & QuestionMetaValue) {
    if (!editingQuestion) return;
    await questionBanksApi.updateQuestion(editingQuestion.id, {
      type: data.type,
      prompt: data.prompt,
      options: data.options ?? [],
      correctOption: data.correctOption,
      imageUrl: data.imageUrl ?? null,
      difficulty: data.difficulty,
      marks: data.marks,
      negativeMarks: data.negativeMarks,
      answerTimeSeconds: data.answerTimeSeconds,
      tags: data.tags,
    });
    setEditingQuestion(null);
    load();
  }

  async function onAddComprehension(data: {
    passageText: string;
    passageImageUrl?: string;
    questions: { type: ComprehensionQuestionType; prompt: string; options?: string[]; correctOption: string; imageUrl?: string }[];
  }) {
    await questionBanksApi.createComprehension(bankId, data);
    setShowComprehensionForm(false);
    load();
  }

  async function onDeleteQuestion(id: string) {
    if (!(await confirm({ message: "Delete this question? This cannot be undone." }))) return;
    await questionBanksApi.removeQuestion(id);
    load();
  }

  if (loading) return <main style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></main>;
  if (error || !bank) return <main style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Question bank not found"}</p></main>;

  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px" }}>
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
            <h1
              onClick={() => {
                setEditingTitle(true);
                setTitleValue(bank.title);
              }}
              style={{ fontSize: 24, fontWeight: 800, cursor: "pointer" }}
              title="Click to rename"
            >
              {bank.title}
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
          <button onClick={onDeleteBank} style={{ ...btnStyle, background: "var(--red)" }}>
            Delete bank
          </button>
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--ink3)" }}>
          {bank.questions.length} question{bank.questions.length === 1 ? "" : "s"}
        </div>
        <span style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowComprehensionForm((s) => !s)} style={{ ...btnStyle, background: "var(--purple-soft)", color: "var(--purple)" }}>
            {showComprehensionForm ? "Close" : "+ Add comprehension"}
          </button>
          <button onClick={() => setShowAddForm((s) => !s)} style={btnStyle}>
            {showAddForm ? "Close" : "+ Add question"}
          </button>
        </span>
      </div>

      {showAddForm && <QuestionForm onSubmit={onAddQuestion} onCancel={() => setShowAddForm(false)} />}
      {showComprehensionForm && <ComprehensionForm onSubmit={onAddComprehension} onCancel={() => setShowComprehensionForm(false)} />}
      {editingQuestion && <QuestionForm initial={editingQuestion} onSubmit={onEditQuestion} onCancel={() => setEditingQuestion(null)} />}

      {bank.questions.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No questions yet — add the first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {(() => {
            let passageCounter = 0;
            return groupQuestions(bank.questions).map((group) =>
              group.kind === "comprehension" ? (
                <ComprehensionGroupCard
                  key={group.passage.id}
                  passageNumber={++passageCounter}
                  passage={group.passage}
                  questions={group.questions}
                  onEdit={setEditingQuestion}
                  onDelete={onDeleteQuestion}
                />
              ) : (
              <div key={group.question.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: "var(--purple-soft)", color: "var(--purple)" }}>
                    {TYPE_LABEL[group.question.type]}
                  </span>
                  <span style={{ display: "flex", gap: 12 }}>
                    <button onClick={() => setEditingQuestion(group.question)} style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      Edit
                    </button>
                    <button onClick={() => onDeleteQuestion(group.question.id)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, cursor: "pointer" }}>
                      Remove
                    </button>
                  </span>
                </div>
                {group.question.imageUrl && <img src={group.question.imageUrl} alt="" style={{ width: "100%", maxHeight: 100, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />}
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, maxHeight: 80, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: group.question.prompt }} />
                <QuestionAnswerSummary question={group.question} />
                <QuestionMetaBadges marks={group.question.marks} negativeMarks={group.question.negativeMarks} difficulty={group.question.difficulty} tags={group.question.tags} />
              </div>
              ),
            );
          })()}
        </div>
      )}
    </main>
  );
}
