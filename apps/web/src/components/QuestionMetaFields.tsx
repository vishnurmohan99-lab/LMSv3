"use client";

import { useEffect, useState } from "react";
import { tagsApi, type Tag, type QuestionDifficulty } from "@/lib/api";

export interface QuestionMetaValue {
  difficulty: QuestionDifficulty;
  marks: number;
  negativeMarks: number;
  answerTimeSeconds: number | null;
  tags: string[];
}

export function emptyQuestionMeta(): QuestionMetaValue {
  return { difficulty: "MEDIUM", marks: 1, negativeMarks: 0, answerTimeSeconds: null, tags: [] };
}

const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "var(--ink2)", display: "block", marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 13.5,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

export default function QuestionMetaFields({ value, onChange }: { value: QuestionMetaValue; onChange: (v: QuestionMetaValue) => void }) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    tagsApi.list().then(setAllTags).catch(() => {});
  }, []);

  function set<K extends keyof QuestionMetaValue>(key: K, v: QuestionMetaValue[K]) {
    onChange({ ...value, [key]: v });
  }
  function addTag(name: string) {
    const n = name.trim();
    if (!n || value.tags.some((t) => t.toLowerCase() === n.toLowerCase())) {
      setTagInput("");
      return;
    }
    set("tags", [...value.tags, n]);
    setTagInput("");
  }
  function removeTag(name: string) {
    set("tags", value.tags.filter((t) => t !== name));
  }

  const suggestions = allTags
    .filter((t) => !value.tags.some((v) => v.toLowerCase() === t.name.toLowerCase()))
    .filter((t) => (tagInput ? t.name.toLowerCase().includes(tagInput.toLowerCase()) : true))
    .slice(0, 8);

  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 18, display: "grid", gap: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.2 }}>Question settings</div>

      <div>
        <label style={labelStyle}>Difficulty</label>
        <select value={value.difficulty} onChange={(e) => set("difficulty", e.target.value as QuestionDifficulty)} style={inputStyle}>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Marks (correct)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={value.marks}
            onChange={(e) => set("marks", e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Negative marks (wrong)</label>
          <input
            type="number"
            min={0}
            step={0.25}
            value={value.negativeMarks}
            onChange={(e) => set("negativeMarks", e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Answer time (seconds) — optional</label>
        <input
          type="number"
          min={0}
          step={5}
          placeholder="e.g. 60"
          value={value.answerTimeSeconds ?? ""}
          onChange={(e) => set("answerTimeSeconds", e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Tags (topics)</label>
        {value.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {value.tags.map((t) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--orange)", background: "var(--orange-soft)", padding: "4px 10px", borderRadius: 8 }}>
                {t}
                <button type="button" onClick={() => removeTag(t)} style={{ border: "none", background: "none", color: "var(--orange)", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }} aria-label={`Remove ${t}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
          placeholder="Type a topic and press Enter, or pick below"
          style={inputStyle}
        />
        {(suggestions.length > 0 || tagInput.trim()) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {tagInput.trim() && !allTags.some((t) => t.name.toLowerCase() === tagInput.trim().toLowerCase()) && (
              <button type="button" onClick={() => addTag(tagInput)} style={chipBtn(true)}>
                + Create “{tagInput.trim()}”
              </button>
            )}
            {suggestions.map((t) => (
              <button key={t.id} type="button" onClick={() => addTag(t.name)} style={chipBtn(false)}>
                {t.name}
              </button>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 6 }}>Tags are shared — reuse them across questions and to build tests by topic.</div>
      </div>
    </div>
  );
}

function chipBtn(create: boolean): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 600,
    padding: "5px 11px",
    borderRadius: 8,
    border: "1px solid var(--line)",
    background: create ? "var(--orange-soft)" : "var(--card)",
    color: create ? "var(--orange)" : "var(--ink2)",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
