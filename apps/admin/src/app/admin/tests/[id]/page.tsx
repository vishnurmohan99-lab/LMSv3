"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import RichTextEditor from "@/components/RichTextEditor";

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
  initial?: TestQuestion;
  onSubmit: (data: { type: QuestionType; prompt: string; options?: string[]; correctOption?: string }) => Promise<void>;
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
        await onSubmit({ type, prompt, options: cleanOptions, correctOption: cleanOptions[correctIndex] ?? cleanOptions[0] });
      } else if (type === "TRUE_FALSE") {
        await onSubmit({ type, prompt, correctOption: trueFalseAnswer });
      } else if (type === "FILL_BLANK") {
        await onSubmit({ type, prompt, correctOption: fillAnswer });
      } else {
        await onSubmit({ type, prompt });
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
  if (question.type === "FILL_BLANK") {
    return <div style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 700 }}>Answer: {question.correctOption}</div>;
  }
  return <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>Freeform answer — ungraded</div>;
}

function ImportFromBankModal({ onClose, onDone }: { onClose: () => void; onDone: (questionIds: string[] | undefined, bankId: string) => Promise<void> }) {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
        setBankQuestions(bank.questions);
        setSelectedIds(new Set());
      })
      .finally(() => setLoadingQuestions(false));
  }, [selectedBankId]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    <Modal title="Add from question bank" onClose={onClose}>
      <div style={{ display: "grid", gap: 14 }}>
        <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} style={inputStyle}>
          <option value="">Select a question bank…</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title} ({b._count?.questions ?? 0})
            </option>
          ))}
        </select>

        {loadingQuestions ? (
          <p style={{ color: "var(--ink2)", fontSize: 13 }}>Loading questions…</p>
        ) : bankQuestions.length > 0 ? (
          <div style={{ display: "grid", gap: 6, maxHeight: 240, overflowY: "auto" }}>
            {bankQuestions.map((q) => (
              <label key={q.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={selectedIds.has(q.id)} onChange={() => toggleSelected(q.id)} style={{ marginTop: 3 }} />
                <span dangerouslySetInnerHTML={{ __html: q.prompt }} />
              </label>
            ))}
          </div>
        ) : selectedBankId ? (
          <p style={{ color: "var(--ink2)", fontSize: 13 }}>This bank has no questions yet.</p>
        ) : null}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={!selectedBankId || importing}
            onClick={onImportWhole}
            style={{ ...btnStyle, opacity: !selectedBankId || importing ? 0.6 : 1 }}
          >
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
    </Modal>
  );
}

export default function AdminTestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const testId = params.id;

  const [test, setTest] = useState<TestTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<TestQuestion | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);

  function load() {
    setLoading(true);
    testsApi
      .get(testId)
      .then(setTest)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load test"))
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
    await testsApi.remove(testId);
    router.push("/admin/tests");
  }

  async function onAddQuestion(data: { type: QuestionType; prompt: string; options?: string[]; correctOption?: string }) {
    await testsApi.createQuestion(testId, data);
    setShowAddModal(false);
    load();
  }

  async function onEditQuestion(data: { type: QuestionType; prompt: string; options?: string[]; correctOption?: string }) {
    if (!editingQuestion) return;
    await testsApi.updateQuestion(editingQuestion.id, {
      type: data.type,
      prompt: data.prompt,
      options: data.options ?? [],
      correctOption: data.correctOption,
    });
    setEditingQuestion(null);
    load();
  }

  async function onDeleteQuestion(id: string) {
    await testsApi.removeQuestion(id);
    load();
  }

  async function onImport(questionIds: string[] | undefined, bankId: string) {
    await testsApi.importQuestions(testId, { questionBankId: bankId, questionIds });
    setShowImportModal(false);
    load();
  }

  if (loading) return <div style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></div>;
  if (error || !test) return <div style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Test not found"}</p></div>;

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--orange)", textTransform: "uppercase", marginBottom: 4 }}>
            Test
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
              {test.title}
              <button
                onClick={() => {
                  setEditingTitle(true);
                  setTitleValue(test.title);
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
              background: test.published ? "var(--amber-soft)" : "var(--green-soft)",
              color: test.published ? "var(--amber)" : "var(--green)",
            }}
          >
            {test.published ? "Unpublish" : "Publish"}
          </button>
          <button onClick={onDeleteTest} style={{ ...btnStyle, background: "var(--red)", display: "flex", alignItems: "center", gap: 6 }}>
            <TrashIcon /> Delete test
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--ink3)" }}>
          {test.testQuestions.length} question{test.testQuestions.length === 1 ? "" : "s"}
        </div>
        <span style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowImportModal(true)} style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)" }}>
            Add from question bank
          </button>
          <button onClick={() => setShowAddModal(true)} style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 7 }}>
            <PlusIcon /> Add manually
          </button>
        </span>
      </div>

      {showAddModal && (
        <Modal title="Add question" onClose={() => setShowAddModal(false)} maxWidth={680}>
          <QuestionForm onSubmit={onAddQuestion} onCancel={() => setShowAddModal(false)} />
        </Modal>
      )}

      {editingQuestion && (
        <Modal title="Edit question" onClose={() => setEditingQuestion(null)} maxWidth={680}>
          <QuestionForm initial={editingQuestion} onSubmit={onEditQuestion} onCancel={() => setEditingQuestion(null)} />
        </Modal>
      )}

      {showImportModal && <ImportFromBankModal onClose={() => setShowImportModal(false)} onDone={onImport} />}

      {test.testQuestions.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No questions yet — add some above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {test.testQuestions.map((question) => (
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
