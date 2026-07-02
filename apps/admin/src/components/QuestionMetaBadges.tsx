import type { QuestionDifficulty, Tag } from "@/lib/api";

const DIFFICULTY_STYLE: Record<QuestionDifficulty, { label: string; color: string; bg: string }> = {
  EASY: { label: "Easy", color: "var(--green)", bg: "var(--green-soft)" },
  MEDIUM: { label: "Medium", color: "var(--amber)", bg: "var(--amber-soft)" },
  HARD: { label: "Hard", color: "var(--red)", bg: "var(--red-soft)" },
};

/** Compact, at-a-glance chips for a question's marks / negative marks / difficulty / tags.
 *  Renders nothing when everything is at its default (1 mark, no negative, medium, no tags)
 *  so plain questions stay visually clean. */
export default function QuestionMetaBadges({
  marks,
  negativeMarks,
  difficulty,
  tags,
}: {
  marks: number;
  negativeMarks: number;
  difficulty: QuestionDifficulty;
  tags: Tag[];
}) {
  const showMarks = marks !== 1 || negativeMarks > 0;
  const showDifficulty = difficulty !== "MEDIUM";
  const showTags = (tags?.length ?? 0) > 0;
  if (!showMarks && !showDifficulty && !showTags) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10, alignItems: "center" }}>
      {showMarks && (
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink3)" }}>
          {marks} mark{marks === 1 ? "" : "s"}
          {negativeMarks > 0 ? ` · −${negativeMarks}` : ""}
        </span>
      )}
      {showDifficulty && (
        <span style={{ fontSize: 10.5, fontWeight: 700, color: DIFFICULTY_STYLE[difficulty].color, background: DIFFICULTY_STYLE[difficulty].bg, padding: "2px 7px", borderRadius: 6 }}>
          {DIFFICULTY_STYLE[difficulty].label}
        </span>
      )}
      {(tags ?? []).map((t) => (
        <span key={t.id} style={{ fontSize: 10.5, fontWeight: 700, color: "var(--orange)", background: "var(--orange-soft)", padding: "2px 7px", borderRadius: 6 }}>
          {t.name}
        </span>
      ))}
    </div>
  );
}
