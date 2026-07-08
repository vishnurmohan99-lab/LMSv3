"use client";

import { useEffect, useState } from "react";
import { planApi, coursesApi, ApiError, type StudyPlanItem, type PlanItemType, type Course, type CourseTree } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--line)",
  borderRadius: "var(--rs)",
  fontSize: 13.5,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};
const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--ink2)", display: "block", marginBottom: 5 };

const TYPE_META: Record<PlanItemType, { label: string; ink: string; bg: string }> = {
  VIDEO: { label: "Video", ink: "var(--orange-deep)", bg: "var(--orange-soft)" },
  NOTES: { label: "Notes", ink: "var(--purple-ink)", bg: "var(--purple-soft)" },
  TEST: { label: "Test", ink: "var(--blue)", bg: "var(--blue-soft)" },
  PRACTICE: { label: "Practice", ink: "var(--green)", bg: "var(--green-soft)" },
  OTHER: { label: "Other", ink: "var(--ink2)", bg: "var(--bg-sunk)" },
};

function resourceForType(type: PlanItemType, courseId: string, chapterId: string, testId: string) {
  switch (type) {
    case "TEST":
      return { resourceKind: testId ? "test" : null, resourceId: testId || null, courseId: courseId || null };
    case "VIDEO":
      return { resourceKind: courseId ? "course" : null, resourceId: chapterId || courseId || null, courseId: courseId || null };
    case "PRACTICE":
      return { resourceKind: "workout", resourceId: null, courseId: courseId || null };
    case "NOTES":
      return { resourceKind: "note", resourceId: null, courseId: courseId || null };
    default:
      return { resourceKind: null, resourceId: null, courseId: courseId || null };
  }
}

export default function BatchStudyPlan({ batchId }: { batchId: string }) {
  const confirm = useConfirm();
  const [items, setItems] = useState<StudyPlanItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // add form
  const [type, setType] = useState<PlanItemType>("VIDEO");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [courseId, setCourseId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [testId, setTestId] = useState("");
  const [saving, setSaving] = useState(false);

  function refresh() {
    return planApi.listBatchPlan(batchId).then(setItems).catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load plan"));
  }

  useEffect(() => {
    Promise.allSettled([planApi.listBatchPlan(batchId), coursesApi.list()])
      .then(([p, c]) => {
        if (p.status === "fulfilled") setItems(p.value);
        else setError(p.reason instanceof ApiError ? p.reason.message : "Failed to load plan");
        if (c.status === "fulfilled") setCourses(c.value);
      })
      .finally(() => setLoading(false));
  }, [batchId]);

  async function onCourseChange(id: string) {
    setCourseId(id);
    setChapterId("");
    setTestId("");
    setTree(null);
    if (!id) return;
    try {
      setTree(await coursesApi.get(id));
    } catch {
      /* ignore */
    }
  }

  async function onAdd() {
    if (!title.trim() || !date) {
      setError("Title and date are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const scheduledFor = new Date(`${date}T${time || "09:00"}`).toISOString();
      const res = resourceForType(type, courseId, chapterId, testId);
      await planApi.createBatchItem(batchId, { scheduledFor, type, title: title.trim(), ...res });
      setTitle("");
      setTestId("");
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to add plan item");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(item: StudyPlanItem) {
    if (!(await confirm({ message: `Remove "${item.title}" from the plan?` }))) return;
    try {
      await planApi.removeItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to delete");
    }
  }

  const tests = tree ? tree.chapters.flatMap((c) => c.tests.map((t) => ({ id: t.id, title: t.title }))) : [];

  // group items by date
  const byDate = new Map<string, StudyPlanItem[]>();
  for (const it of items) {
    const key = new Date(it.scheduledFor).toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(it);
  }
  const dates = [...byDate.keys()].sort();

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 22, marginTop: 24 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Study plan (timetable)</div>
      <div style={{ fontSize: 12.5, color: "var(--ink3)", fontWeight: 600, marginBottom: 18 }}>Scheduled items every student in this batch sees on their Planner.</div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {/* Add form */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, alignItems: "end", padding: 16, background: "var(--bg-sunk)", borderRadius: "var(--rm)", marginBottom: 20 }}>
        <div>
          <label style={label}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as PlanItemType)} style={{ ...inputStyle, cursor: "pointer" }}>
            {(Object.keys(TYPE_META) as PlanItemType[]).map((t) => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: "span 2", minWidth: 0 }}>
          <label style={label}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kinematics — lecture 1" style={inputStyle} />
        </div>
        <div>
          <label style={label}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={label}>Time</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={label}>Course (link)</label>
          <select value={courseId} onChange={(e) => onCourseChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="">None</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        {type === "TEST" ? (
          <div>
            <label style={label}>Test</label>
            <select value={testId} onChange={(e) => setTestId(e.target.value)} disabled={!courseId} style={{ ...inputStyle, cursor: "pointer", opacity: courseId ? 1 : 0.5 }}>
              <option value="">{courseId ? "Select test" : "Pick course first"}</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label style={label}>Chapter (optional)</label>
            <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} disabled={!tree} style={{ ...inputStyle, cursor: "pointer", opacity: tree ? 1 : 0.5 }}>
              <option value="">Whole course</option>
              {tree?.chapters.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        )}
        <button onClick={onAdd} disabled={saving} style={{ padding: "10px 16px", background: "var(--orange)", color: "#fff", border: "none", borderRadius: "var(--rs)", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, height: 38 }}>
          {saving ? "Adding…" : "Add to plan"}
        </button>
      </div>

      {/* Items grouped by date */}
      {loading ? (
        <p style={{ color: "var(--ink3)", fontSize: 13 }}>Loading…</p>
      ) : dates.length === 0 ? (
        <p style={{ color: "var(--ink3)", fontSize: 13 }}>No plan items yet — add the first above.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {dates.map((d) => (
            <div key={d}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ink2)", marginBottom: 8 }}>
                {new Date(d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {byDate.get(d)!.map((it) => (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1px solid var(--line)", borderRadius: "var(--rs)" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink3)", width: 44, flex: "none" }}>
                      {new Date(it.scheduledFor).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: TYPE_META[it.type].ink, background: TYPE_META[it.type].bg, borderRadius: 999, padding: "3px 9px", flex: "none" }}>{TYPE_META[it.type].label}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                    <button onClick={() => onDelete(it)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flex: "none" }}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
