"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  testsApi,
  questionBanksApi,
  ApiError,
  type TestTree,
  type TestQuestion,
  type QuestionType,
  type QuestionBank,
  type Question,
} from "@/lib/api";
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

// Mock tests are auto-graded only — ESSAY is excluded since there's no grading workflow for it.
const TYPE_LABEL: Record<Exclude<QuestionType, "ESSAY">, string> = {
  MCQ: "Multiple choice",
  FILL_BLANK: "Fill in the blank",
  TRUE_FALSE: "True / False",
};

function QuestionForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: TestQuestion;
  onSubmit: (data: { type: QuestionType; prompt: string; options?: string[]; correctOption?: string } & QuestionMetaValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [type, setType] = useState<Exclude<QuestionType, "ESSAY">>(initial?.type !== "ESSAY" && initial?.type ? initial.type : "MCQ");
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
      if (type === "MCQ") {
        const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
        if (cleanOptions.length < 2) throw new Error("Add at least 2 options");
        await onSubmit({ type, prompt, options: cleanOptions, correctOption: cleanOptions[correctIndex] ?? cleanOptions[0], ...meta });
      } else if (type === "TRUE_FALSE") {
        await onSubmit({ type, prompt, correctOption: trueFalseAnswer, ...meta });
      } else if (type === "FILL_BLANK") {
        await onSubmit({ type, prompt, correctOption: fillAnswer, ...meta });
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
      <select value={type} onChange={(e) => setType(e.target.value as Exclude<QuestionType, "ESSAY">)} style={inputStyle}>
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

function QuestionAnswerSummary({ question }: { question: TestQuestion }) {
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
  return <div style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 700 }}>Answer: {question.correctOption}</div>;
}

function ImportFromBank({ onDone }: { onDone: (questionIds: string[] | undefined, bankId: string) => Promise<void> }) {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    questionBanksApi.list().then(setBanks).catch(() => setError("Failed to load question banks"));
  }, []);

  useEffect(() => {
    if (!selectedBankId) {
      setBankQuestions([]);
      return;
    }
    setLoadingQuestions(true);
    questionBanksApi
      .get(selectedBankId)
      .then((bank) => {
        // mock tests only support auto-gradable types
        setBankQuestions(bank.questions.filter((q) => q.type !== "ESSAY"));
        setSelectedIds(new Set());
        setTagFilter(new Set());
      })
      .finally(() => setLoadingQuestions(false));
  }, [selectedBankId]);

  // Tags present across the loaded bank's questions, for the "build by topic" filter.
  const bankTags = useMemo(() => {
    const names = new Set<string>();
    for (const q of bankQuestions) for (const t of q.tags ?? []) names.add(t.name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [bankQuestions]);

  // A question matches when it carries at least one of the selected tags (OR match).
  const filteredQuestions = useMemo(
    () => (tagFilter.size === 0 ? bankQuestions : bankQuestions.filter((q) => (q.tags ?? []).some((t) => tagFilter.has(t.name)))),
    [bankQuestions, tagFilter],
  );

  function toggleTagFilter(name: string) {
    setTagFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllShown() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const q of filteredQuestions) next.add(q.id);
      return next;
    });
  }

  async function onImportWhole() {
    if (!selectedBankId) return;
    setImporting(true);
    setError(null);
    try {
      await onDone(undefined, selectedBankId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to import");
    } finally {
      setImporting(false);
    }
  }

  async function onImportSelected() {
    if (!selectedBankId || selectedIds.size === 0) return;
    setImporting(true);
    setError(null);
    try {
      await onDone(Array.from(selectedIds), selectedBankId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to import");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14, marginBottom: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16 }}>
      <p style={{ fontSize: 12, color: "var(--ink3)", margin: 0 }}>Only MCQ, True/False, and Fill-in-the-blank questions can be imported — essay questions are skipped since mock tests are auto-graded.</p>
      <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} style={inputStyle}>
        <option value="">Select a question bank…</option>
        {banks.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title} ({b._count?.questions ?? 0})
          </option>
        ))}
      </select>

      {bankTags.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Filter by tag (topic)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {bankTags.map((name) => {
              const on = tagFilter.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleTagFilter(name)}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "5px 11px",
                    borderRadius: 8,
                    border: on ? "1px solid var(--orange)" : "1px solid var(--line)",
                    background: on ? "var(--orange-soft)" : "var(--card)",
                    color: on ? "var(--orange)" : "var(--ink2)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {name}
                </button>
              );
            })}
            {tagFilter.size > 0 && (
              <button type="button" onClick={() => setTagFilter(new Set())} style={{ background: "none", border: "none", color: "var(--ink3)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {loadingQuestions ? (
        <p style={{ color: "var(--ink2)", fontSize: 13 }}>Loading questions…</p>
      ) : filteredQuestions.length > 0 ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--ink3)" }}>
            <span>
              Showing {filteredQuestions.length} of {bankQuestions.length} question{bankQuestions.length === 1 ? "" : "s"}
            </span>
            <button type="button" onClick={selectAllShown} style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              Select all shown
            </button>
          </div>
          <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
            {filteredQuestions.map((q) => (
              <label key={q.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={selectedIds.has(q.id)} onChange={() => toggleSelected(q.id)} style={{ marginTop: 3 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span dangerouslySetInnerHTML={{ __html: q.prompt }} />
                  {((q.tags ?? []).length > 0 || q.marks !== 1 || q.negativeMarks > 0) && (
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink3)" }}>{q.marks} mark{q.marks === 1 ? "" : "s"}</span>
                      {q.negativeMarks > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--red)" }}>−{q.negativeMarks}</span>}
                      {(q.tags ?? []).map((t) => (
                        <span key={t.id} style={{ fontSize: 10.5, fontWeight: 700, color: "var(--orange)", background: "var(--orange-soft)", padding: "2px 7px", borderRadius: 6 }}>
                          {t.name}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </>
      ) : selectedBankId && bankQuestions.length > 0 ? (
        <p style={{ color: "var(--ink2)", fontSize: 13 }}>No questions match the selected tags.</p>
      ) : selectedBankId ? (
        <p style={{ color: "var(--ink2)", fontSize: 13 }}>This bank has no auto-gradable questions.</p>
      ) : null}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={!selectedBankId || importing} onClick={onImportWhole} style={{ ...btnStyle, opacity: !selectedBankId || importing ? 0.6 : 1 }}>
          {importing ? "Importing…" : "Import whole bank"}
        </button>
        <button
          type="button"
          disabled={selectedIds.size === 0 || importing}
          onClick={onImportSelected}
          style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)", opacity: selectedIds.size === 0 || importing ? 0.6 : 1 }}
        >
          Import selected ({selectedIds.size})
        </button>
      </div>
      {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
    </div>
  );
}

export default function FacultyMockTestBuilderPage() {
  const params = useParams<{ id: string; testId: string }>();
  const router = useRouter();
  const courseId = params.id;
  const testId = params.testId;
  const confirm = useConfirm();

  const [test, setTest] = useState<TestTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<TestQuestion | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);

  function load() {
    setLoading(true);
    testsApi
      .get(testId)
      .then(setTest)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load mock test"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [testId]);

  async function onTogglePublished() {
    if (!test) return;
    const updated = await testsApi.update(test.id, { published: !test.published });
    setTest({ ...test, published: updated.published });
  }

  async function onSaveTitle() {
    if (!test) return;
    await testsApi.update(test.id, { title: titleValue });
    setEditingTitle(false);
    load();
  }

  async function onDeleteTest() {
    if (!(await confirm({ message: "Delete this mock test and all its questions? This cannot be undone." }))) return;
    await testsApi.remove(testId);
    router.push(`/admin/courses/${courseId}/mock-tests`);
  }

  async function onAddQuestion(data: { type: QuestionType; prompt: string; options?: string[]; correctOption?: string } & QuestionMetaValue) {
    await testsApi.createQuestion(testId, data);
    setShowAddForm(false);
    load();
  }

  async function onEditQuestion(data: { type: QuestionType; prompt: string; options?: string[]; correctOption?: string } & QuestionMetaValue) {
    if (!editingQuestion) return;
    await testsApi.updateQuestion(editingQuestion.id, {
      type: data.type,
      prompt: data.prompt,
      options: data.options ?? [],
      correctOption: data.correctOption,
      difficulty: data.difficulty,
      marks: data.marks,
      negativeMarks: data.negativeMarks,
      answerTimeSeconds: data.answerTimeSeconds,
      tags: data.tags,
    });
    setEditingQuestion(null);
    load();
  }

  async function onDeleteQuestion(id: string) {
    if (!(await confirm({ message: "Delete this question? This cannot be undone." }))) return;
    await testsApi.removeQuestion(id);
    load();
  }

  async function onImport(questionIds: string[] | undefined, bankId: string) {
    await testsApi.importQuestions(testId, { questionBankId: bankId, questionIds });
    setShowImport(false);
    load();
  }

  if (loading) return <main style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></main>;
  if (error || !test) return <main style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Mock test not found"}</p></main>;

  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <Link href={`/admin/courses/${courseId}/mock-tests`} style={{ color: "var(--ink3)", fontSize: 13, fontWeight: 700 }}>
        ← Back to Mock Tests
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 14, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--orange)", textTransform: "uppercase", marginBottom: 4 }}>
            Mock Test
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
                setTitleValue(test.title);
              }}
              style={{ fontSize: 24, fontWeight: 800, cursor: "pointer" }}
              title="Click to rename"
            >
              {test.title}
            </h1>
          )}
        </div>
        <span style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onTogglePublished}
            style={{
              ...btnStyle,
              background: test.published ? "var(--amber-soft)" : "var(--green-soft)",
              color: test.published ? "var(--amber)" : "var(--green)",
            }}
          >
            {test.published ? "Unpublish" : "Publish"}
          </button>
          <button onClick={onDeleteTest} style={{ ...btnStyle, background: "var(--red)" }}>
            Delete mock test
          </button>
        </span>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showSchedule ? 12 : 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)" }}>Publish mode</div>
          <button
            onClick={() => setShowSchedule((s) => !s)}
            style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
          >
            {showSchedule ? "Hide" : "Configure"}
          </button>
        </div>
        {showSchedule && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 10 }}>
              {(["MANUAL", "TIMED"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={async () => {
                    const updated = await testsApi.update(test.id, { publishMode: mode });
                    setTest({ ...test, publishMode: updated.publishMode });
                  }}
                  style={{
                    flex: 1,
                    padding: "9px 14px",
                    borderRadius: 10,
                    border: test.publishMode === mode ? "1px solid var(--ink)" : "1px solid var(--line)",
                    background: test.publishMode === mode ? "var(--ink)" : "var(--bg)",
                    color: test.publishMode === mode ? "#fff" : "var(--ink2)",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {mode === "MANUAL" ? "Manual" : "Timed"}
                </button>
              ))}
            </div>
            {test.publishMode === "TIMED" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ fontSize: 12, color: "var(--ink2)" }}>
                  Opens at
                  <input
                    type="datetime-local"
                    defaultValue={test.availableFrom ? test.availableFrom.slice(0, 16) : ""}
                    onBlur={async (e) => {
                      const updated = await testsApi.update(test.id, { availableFrom: e.target.value ? new Date(e.target.value).toISOString() : null });
                      setTest({ ...test, availableFrom: updated.availableFrom });
                    }}
                    style={{ ...inputStyle, width: "100%", marginTop: 4 }}
                  />
                </label>
                <label style={{ fontSize: 12, color: "var(--ink2)" }}>
                  Closes at
                  <input
                    type="datetime-local"
                    defaultValue={test.availableUntil ? test.availableUntil.slice(0, 16) : ""}
                    onBlur={async (e) => {
                      const updated = await testsApi.update(test.id, { availableUntil: e.target.value ? new Date(e.target.value).toISOString() : null });
                      setTest({ ...test, availableUntil: updated.availableUntil });
                    }}
                    style={{ ...inputStyle, width: "100%", marginTop: 4 }}
                  />
                </label>
                <label style={{ fontSize: 12, color: "var(--ink2)", gridColumn: "1 / -1" }}>
                  Duration (minutes)
                  <input
                    type="number"
                    min={1}
                    defaultValue={test.durationMinutes ?? ""}
                    onBlur={async (e) => {
                      const updated = await testsApi.update(test.id, { durationMinutes: e.target.value ? Number(e.target.value) : null });
                      setTest({ ...test, durationMinutes: updated.durationMinutes });
                    }}
                    style={{ ...inputStyle, width: "100%", marginTop: 4 }}
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)" }}>Pass mark</div>
            <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 2 }}>Students pass at this score or above — used for &ldquo;Pass a test&rdquo; course completion.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              min={0}
              max={100}
              defaultValue={test.passPercent}
              onBlur={async (e) => {
                const value = e.target.value === "" ? 50 : Math.min(100, Math.max(0, Number(e.target.value)));
                const updated = await testsApi.update(test.id, { passPercent: value });
                setTest({ ...test, passPercent: updated.passPercent });
              }}
              style={{ ...inputStyle, width: 90, textAlign: "right" }}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink2)" }}>%</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--ink3)" }}>
          {test.testQuestions.length} question{test.testQuestions.length === 1 ? "" : "s"}
        </div>
        <span style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowImport((s) => !s)} style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)" }}>
            {showImport ? "Close" : "Add from question bank"}
          </button>
          <button onClick={() => setShowAddForm((s) => !s)} style={btnStyle}>
            {showAddForm ? "Close" : "+ Add manually"}
          </button>
        </span>
      </div>

      {showImport && <ImportFromBank onDone={onImport} />}
      {showAddForm && <QuestionForm onSubmit={onAddQuestion} onCancel={() => setShowAddForm(false)} />}
      {editingQuestion && <QuestionForm initial={editingQuestion} onSubmit={onEditQuestion} onCancel={() => setEditingQuestion(null)} />}

      {test.testQuestions.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No questions yet — add some above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {test.testQuestions.map((question) => (
            <div key={question.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: "var(--purple-soft)", color: "var(--purple)" }}>
                  {question.type === "ESSAY" ? "Essay" : TYPE_LABEL[question.type]}
                </span>
                <span style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => setEditingQuestion(question)} style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    Edit
                  </button>
                  <button onClick={() => onDeleteQuestion(question.id)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, cursor: "pointer" }}>
                    Remove
                  </button>
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, maxHeight: 80, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: question.prompt }} />
              <QuestionAnswerSummary question={question} />
              <QuestionMetaBadges marks={question.marks} negativeMarks={question.negativeMarks} difficulty={question.difficulty} tags={question.tags} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
