"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { coursesApi, segmentsApi, ApiError, type Course, type Segment } from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
};

const smallBtn: React.CSSProperties = {
  padding: "8px 14px",
  background: "var(--ink)",
  color: "#fff",
  border: "none",
  borderRadius: 9,
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
};

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.8">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  );
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 7,
        background: published ? "var(--green-soft)" : "var(--amber-soft)",
        color: published ? "var(--green)" : "var(--amber)",
      }}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

function CourseRow({ course, onRemove }: { course: Course; onRemove: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "9px 12px",
        background: "var(--bg)",
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link href={`/admin/courses/${course.id}`} style={{ fontWeight: 700 }}>
          {course.title}
        </Link>
        <StatusBadge published={course.published} />
      </span>
      <button onClick={onRemove} title="Remove from this category" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        <TrashIcon />
      </button>
    </div>
  );
}

function AddCoursePicker({ allCourses, onPick }: { allCourses: Course[]; onPick: (courseId: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const matches = useMemo(
    () => allCourses.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())).slice(0, 8),
    [allCourses, search],
  );

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...smallBtn, marginTop: 10 }}>
        + Add existing course
      </button>
    );
  }

  async function handlePick(courseId: string) {
    setAssigningId(courseId);
    try {
      await onPick(courseId);
      setOpen(false);
      setSearch("");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 10, padding: 12, background: "var(--card)" }}>
      <input
        autoFocus
        placeholder="Search courses by title…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
      />
      {matches.length === 0 ? (
        <p style={{ color: "var(--ink3)", fontSize: 12.5 }}>No matching courses.</p>
      ) : (
        <div style={{ display: "grid", gap: 4, maxHeight: 200, overflowY: "auto" }}>
          {matches.map((c) => (
            <button
              key={c.id}
              disabled={assigningId !== null}
              onClick={() => handlePick(c.id)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 10px",
                background: "var(--bg)",
                border: "none",
                borderRadius: 7,
                fontSize: 13,
                fontFamily: "inherit",
                cursor: assigningId !== null ? "default" : "pointer",
                textAlign: "left",
                opacity: assigningId !== null && assigningId !== c.id ? 0.5 : 1,
              }}
            >
              <span>{c.title}</span>
              {assigningId === c.id ? (
                <Spinner size={13} color="var(--orange)" />
              ) : (
                <span style={{ color: "var(--orange)", fontWeight: 700, fontSize: 12 }}>Add</span>
              )}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(false)}
        style={{ marginTop: 8, background: "none", border: "none", color: "var(--ink3)", fontSize: 12, cursor: "pointer" }}
      >
        Cancel
      </button>
    </div>
  );
}

export default function SegmentDetailPage() {
  const params = useParams<{ id: string }>();
  const segmentId = params.id;

  const [segment, setSegment] = useState<Segment | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [addingSub, setAddingSub] = useState(false);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([segmentsApi.get(segmentId), coursesApi.list()])
      .then(([s, c]) => {
        setSegment(s);
        setAllCourses(c);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load segment"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [segmentId]);

  async function onAddSubsegment(e: React.FormEvent) {
    e.preventDefault();
    setAddingSub(true);
    try {
      await segmentsApi.createSubsegment(segmentId, { name: newSubName });
      setNewSubName("");
      setShowAddSub(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add sub-segment");
    } finally {
      setAddingSub(false);
    }
  }

  async function onDeleteSubsegment(id: string) {
    await segmentsApi.removeSubsegment(id);
    load();
  }

  async function onAssignToSegment(courseId: string) {
    await coursesApi.update(courseId, { segmentId, subsegmentId: undefined });
    await load();
  }

  async function onAssignToSubsegment(courseId: string, subsegmentId: string) {
    await coursesApi.update(courseId, { segmentId, subsegmentId });
    await load();
  }

  async function onRemoveFromCategory(courseId: string) {
    await coursesApi.update(courseId, { segmentId: null, subsegmentId: null });
    load();
  }

  if (loading) return <div style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></div>;
  if (error || !segment) return <div style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Segment not found"}</p></div>;

  const directCourses = allCourses.filter((c) => c.segmentId === segmentId && !c.subsegmentId);

  return (
    <div style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <Link href="/admin/segments" style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
        ← Back to segments
      </Link>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 12, marginBottom: 22 }}>{segment.name}</div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {/* Subsegments */}
      <section
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rl)",
          padding: 20,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Sub-segments</div>
          <button onClick={() => setShowAddSub(true)} style={smallBtn}>
            + Add sub-segment
          </button>
        </div>

        {showAddSub && (
          <Modal title="Add sub-segment" onClose={() => setShowAddSub(false)}>
            <form onSubmit={onAddSubsegment}>
              <input
                required
                autoFocus
                placeholder="Sub-segment name"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                style={{ ...inputStyle, width: "100%", marginBottom: 14 }}
              />
              <button
                type="submit"
                disabled={addingSub}
                style={{
                  ...smallBtn,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "11px 18px",
                  fontSize: 14,
                  opacity: addingSub ? 0.7 : 1,
                }}
              >
                {addingSub && <Spinner />}
                {addingSub ? "Adding…" : "Add sub-segment"}
              </button>
            </form>
          </Modal>
        )}

        {segment.subsegments.length === 0 ? (
          <p style={{ color: "var(--ink2)", fontSize: 13.5 }}>No sub-segments yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {segment.subsegments.map((sub) => {
              const subCourses = allCourses.filter((c) => c.subsegmentId === sub.id);
              const expanded = expandedSub === sub.id;
              return (
                <div key={sub.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>
                      {sub.name} <span style={{ color: "var(--ink3)", fontWeight: 500, fontSize: 12.5 }}>· {subCourses.length} courses</span>
                    </span>
                    <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <button
                        onClick={() => setExpandedSub(expanded ? null : sub.id)}
                        style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                      >
                        {expanded ? "Hide courses" : "Manage courses"}
                      </button>
                      <button onClick={() => onDeleteSubsegment(sub.id)} title="Delete" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        <TrashIcon />
                      </button>
                    </span>
                  </div>

                  {expanded && (
                    <div style={{ marginTop: 12 }}>
                      {subCourses.length > 0 && (
                        <div style={{ display: "grid", gap: 6, marginBottom: 4 }}>
                          {subCourses.map((c) => (
                            <CourseRow key={c.id} course={c} onRemove={() => onRemoveFromCategory(c.id)} />
                          ))}
                        </div>
                      )}
                      <AddCoursePicker allCourses={allCourses} onPick={(courseId) => onAssignToSubsegment(courseId, sub.id)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Direct courses */}
      <section
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rl)",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
          Courses directly in {segment.name}
        </div>

        {directCourses.length === 0 ? (
          <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 4 }}>No courses assigned directly yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 6, marginBottom: 4 }}>
            {directCourses.map((c) => (
              <CourseRow key={c.id} course={c} onRemove={() => onRemoveFromCategory(c.id)} />
            ))}
          </div>
        )}

        <AddCoursePicker allCourses={allCourses} onPick={onAssignToSegment} />
      </section>
    </div>
  );
}
