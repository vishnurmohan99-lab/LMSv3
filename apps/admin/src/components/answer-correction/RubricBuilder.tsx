"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  answerQuestionTypesApi,
  answerQuestionsApi,
  ApiError,
  type AnswerQuestionType,
  type AnswerQuestion,
  type AnswerForbiddenPenaltyType,
} from "@/lib/api";
import RichTextEditor from "@/components/RichTextEditor";
import Spinner from "@/components/Spinner";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
  width: "100%",
};

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--rl)",
  padding: 20,
  marginBottom: 18,
};

type PointDraft = { text: string; marks: number };
type GroupPointDraft = { text: string };
type GroupDraft = { minRequired: number; marks: number; points: GroupPointDraft[] };
type PartDraft = { partKey: string; name: string; marks: number; mustInclude: PointDraft[]; groups: GroupDraft[] };
type ForbiddenDraft = { text: string; category: string; penaltyType: AnswerForbiddenPenaltyType; penalty: number };

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function reconciles(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

function ReconBanner({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      style={{
        fontSize: 12.5,
        fontWeight: 700,
        padding: "7px 12px",
        borderRadius: 8,
        background: ok ? "var(--green-soft)" : "var(--red-soft)",
        color: ok ? "var(--green)" : "var(--red)",
        marginTop: 8,
      }}
    >
      {ok ? "✓" : "✗"} {label}
    </div>
  );
}

export default function RubricBuilder({ questionId }: { questionId?: string }) {
  const router = useRouter();
  const [types, setTypes] = useState<AnswerQuestionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [directive, setDirective] = useState("");
  const [maxMarks, setMaxMarks] = useState(10);
  const [typeId, setTypeId] = useState("");
  const [modelAnswer, setModelAnswer] = useState("");
  const [published, setPublished] = useState(false);
  const [parts, setParts] = useState<PartDraft[]>([]);
  const [forbiddenPoints, setForbiddenPoints] = useState<ForbiddenDraft[]>([]);

  useEffect(() => {
    answerQuestionTypesApi
      .list()
      .then(setTypes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!questionId) {
      setLoading(false);
      return;
    }
    answerQuestionsApi
      .get(questionId)
      .then((q: AnswerQuestion) => {
        setText(q.text);
        setDirective(q.directive ?? "");
        setMaxMarks(q.maxMarks);
        setTypeId(q.typeId);
        setModelAnswer(q.modelAnswer ?? "");
        setPublished(q.published);
        setParts(
          q.parts.map((p) => ({
            partKey: p.partKey,
            name: p.name,
            marks: p.marks,
            mustInclude: p.mustIncludePoints.map((pt) => ({ text: pt.text, marks: pt.marks })),
            groups: p.groups.map((g) => ({ minRequired: g.minRequired, marks: g.marks, points: g.points.map((pt) => ({ text: pt.text })) })),
          })),
        );
        setForbiddenPoints(q.forbiddenPoints.map((f) => ({ text: f.text, category: f.category, penaltyType: f.penaltyType, penalty: f.penalty })));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load question"))
      .finally(() => setLoading(false));
  }, [questionId]);

  function onTypeChange(newTypeId: string) {
    setTypeId(newTypeId);
    if (questionId) return; // don't reseed parts on edit
    const type = types.find((t) => t.id === newTypeId);
    if (!type) return;
    setParts(
      type.parts.map((p) => ({
        partKey: p.partKey,
        name: p.name,
        marks: round2(p.defaultWeight * maxMarks),
        mustInclude: [],
        groups: [],
      })),
    );
  }

  function updatePart(i: number, patch: Partial<PartDraft>) {
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function partPointsSum(part: PartDraft) {
    const mustSum = part.mustInclude.reduce((s, p) => s + (Number(p.marks) || 0), 0);
    const groupSum = part.groups.reduce((s, g) => s + (Number(g.marks) || 0), 0);
    return round2(mustSum + groupSum);
  }

  const partsSum = round2(parts.reduce((s, p) => s + (Number(p.marks) || 0), 0));
  const overallOk = reconciles(partsSum, maxMarks);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!overallOk) {
      setError(`Part marks (${partsSum}) must sum to max marks (${maxMarks})`);
      return;
    }
    for (const part of parts) {
      const sum = partPointsSum(part);
      if (!reconciles(sum, part.marks)) {
        setError(`Part "${part.name}" points (${sum}) must sum to its marks (${part.marks})`);
        return;
      }
      for (const g of part.groups) {
        if (g.minRequired > g.points.length) {
          setError(`Group minRequired (${g.minRequired}) exceeds its point count (${g.points.length}) in part "${part.name}"`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        text,
        directive: directive || undefined,
        maxMarks: Number(maxMarks),
        typeId,
        modelAnswer,
        published,
        parts: parts.map((p, i) => ({
          partKey: p.partKey,
          name: p.name,
          order: i,
          marks: Number(p.marks),
          mustInclude: p.mustInclude.map((pt) => ({ text: pt.text, marks: Number(pt.marks) })),
          groups: p.groups.map((g) => ({ minRequired: Number(g.minRequired), marks: Number(g.marks), points: g.points.map((pt) => ({ text: pt.text })) })),
        })),
        forbiddenPoints: forbiddenPoints.map((f) => ({ text: f.text, category: f.category, penaltyType: f.penaltyType, penalty: Number(f.penalty) })),
      };
      if (questionId) {
        await answerQuestionsApi.update(questionId, payload);
      } else {
        await answerQuestionsApi.create(payload);
      }
      router.push("/admin/answer-correction");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ padding: 40, color: "var(--ink2)" }}>Loading…</p>;

  return (
    <div className="fade-in" style={{ padding: "30px 40px 80px", maxWidth: 900 }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 22 }}>
        {questionId ? "Edit question" : "New question"}
      </div>

      <form onSubmit={onSubmit}>
        <div style={cardStyle}>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Question text</div>
              <RichTextEditor value={text} onChange={setText} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Directive (optional)</div>
                <input placeholder="e.g. Examine" value={directive} onChange={(e) => setDirective(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Max marks</div>
                <input required type="number" min={1} value={maxMarks} onChange={(e) => setMaxMarks(Number(e.target.value))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Question type</div>
                <select required value={typeId} onChange={(e) => onTypeChange(e.target.value)} style={inputStyle}>
                  <option value="" disabled>
                    Select…
                  </option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Model answer</div>
              <RichTextEditor value={modelAnswer} onChange={setModelAnswer} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
              Published (visible to students/faculty)
            </label>
          </div>
        </div>

        {parts.map((part, pi) => {
          const sum = partPointsSum(part);
          const ok = reconciles(sum, part.marks);
          return (
            <div key={pi} style={cardStyle}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 100px", gap: 12, marginBottom: 14 }}>
                <input value={part.name} onChange={(e) => updatePart(pi, { name: e.target.value })} style={{ ...inputStyle, fontWeight: 700 }} />
                <input
                  type="number"
                  step="0.5"
                  value={part.marks}
                  onChange={(e) => updatePart(pi, { marks: Number(e.target.value) })}
                  style={inputStyle}
                  title="Part marks"
                />
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Must-include points</div>
              <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
                {part.mustInclude.map((pt, pti) => (
                  <div key={pti} style={{ display: "grid", gridTemplateColumns: "1fr 80px 30px", gap: 8 }}>
                    <input
                      placeholder="Point text"
                      value={pt.text}
                      onChange={(e) =>
                        updatePart(pi, { mustInclude: part.mustInclude.map((p, i) => (i === pti ? { ...p, text: e.target.value } : p)) })
                      }
                      style={{ ...inputStyle, padding: "8px 10px" }}
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="marks"
                      value={pt.marks}
                      onChange={(e) =>
                        updatePart(pi, { mustInclude: part.mustInclude.map((p, i) => (i === pti ? { ...p, marks: Number(e.target.value) } : p)) })
                      }
                      style={{ ...inputStyle, padding: "8px 10px" }}
                    />
                    <button
                      type="button"
                      onClick={() => updatePart(pi, { mustInclude: part.mustInclude.filter((_, i) => i !== pti) })}
                      style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => updatePart(pi, { mustInclude: [...part.mustInclude, { text: "", marks: 0 }] })}
                style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12.5, cursor: "pointer", marginBottom: 14 }}
              >
                + Add must-include point
              </button>

              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>
                &quot;Any N of M&quot; groups (open questions)
              </div>
              {part.groups.map((g, gi) => (
                <div key={gi} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 30px", gap: 8, marginBottom: 8 }}>
                    <input
                      type="number"
                      placeholder="min required"
                      value={g.minRequired}
                      onChange={(e) =>
                        updatePart(pi, { groups: part.groups.map((gg, i) => (i === gi ? { ...gg, minRequired: Number(e.target.value) } : gg)) })
                      }
                      style={{ ...inputStyle, padding: "8px 10px" }}
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="group marks"
                      value={g.marks}
                      onChange={(e) =>
                        updatePart(pi, { groups: part.groups.map((gg, i) => (i === gi ? { ...gg, marks: Number(e.target.value) } : gg)) })
                      }
                      style={{ ...inputStyle, padding: "8px 10px" }}
                    />
                    <button
                      type="button"
                      onClick={() => updatePart(pi, { groups: part.groups.filter((_, i) => i !== gi) })}
                      style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                  {g.points.map((pt, pti) => (
                    <div key={pti} style={{ display: "grid", gridTemplateColumns: "1fr 30px", gap: 8, marginBottom: 6 }}>
                      <input
                        placeholder="Point text"
                        value={pt.text}
                        onChange={(e) =>
                          updatePart(pi, {
                            groups: part.groups.map((gg, i) =>
                              i === gi ? { ...gg, points: gg.points.map((p, j) => (j === pti ? { text: e.target.value } : p)) } : gg,
                            ),
                          })
                        }
                        style={{ ...inputStyle, padding: "8px 10px" }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updatePart(pi, { groups: part.groups.map((gg, i) => (i === gi ? { ...gg, points: gg.points.filter((_, j) => j !== pti) } : gg)) })
                        }
                        style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updatePart(pi, { groups: part.groups.map((gg, i) => (i === gi ? { ...gg, points: [...gg.points, { text: "" }] } : gg)) })
                    }
                    style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                  >
                    + Add point to group
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => updatePart(pi, { groups: [...part.groups, { minRequired: 1, marks: 0, points: [] }] })}
                style={{ background: "none", border: "none", color: "var(--purple)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
              >
                + Add group
              </button>

              <ReconBanner ok={ok} label={`Points sum to ${sum} / part marks ${part.marks}`} />
            </div>
          );
        })}

        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 10 }}>Forbidden points (lose marks if present)</div>
          {forbiddenPoints.map((f, fi) => (
            <div key={fi} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px 30px", gap: 8, marginBottom: 8 }}>
              <input
                placeholder="Text"
                value={f.text}
                onChange={(e) => setForbiddenPoints((prev) => prev.map((p, i) => (i === fi ? { ...p, text: e.target.value } : p)))}
                style={{ ...inputStyle, padding: "8px 10px" }}
              />
              <input
                placeholder="Category"
                value={f.category}
                onChange={(e) => setForbiddenPoints((prev) => prev.map((p, i) => (i === fi ? { ...p, category: e.target.value } : p)))}
                style={{ ...inputStyle, padding: "8px 10px" }}
              />
              <select
                value={f.penaltyType}
                onChange={(e) => setForbiddenPoints((prev) => prev.map((p, i) => (i === fi ? { ...p, penaltyType: e.target.value as AnswerForbiddenPenaltyType } : p)))}
                style={{ ...inputStyle, padding: "8px 10px" }}
              >
                <option value="NUMERIC">Numeric penalty</option>
                <option value="FLAG_HARD">Flag for review</option>
              </select>
              <input
                type="number"
                step="0.5"
                disabled={f.penaltyType === "FLAG_HARD"}
                placeholder="penalty"
                value={f.penalty}
                onChange={(e) => setForbiddenPoints((prev) => prev.map((p, i) => (i === fi ? { ...p, penalty: Number(e.target.value) } : p)))}
                style={{ ...inputStyle, padding: "8px 10px", opacity: f.penaltyType === "FLAG_HARD" ? 0.5 : 1 }}
              />
              <button
                type="button"
                onClick={() => setForbiddenPoints((prev) => prev.filter((_, i) => i !== fi))}
                style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setForbiddenPoints((prev) => [...prev, { text: "", category: "", penaltyType: "NUMERIC", penalty: 0 }])}
            style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
          >
            + Add forbidden point
          </button>
        </div>

        <ReconBanner ok={overallOk} label={`Part marks sum to ${partsSum} / max marks ${maxMarks}`} />

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 14 }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 22px",
              background: "var(--ink)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving && <Spinner />}
            {saving ? "Saving…" : "Save question"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/answer-correction")}
            style={{ padding: "11px 22px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
