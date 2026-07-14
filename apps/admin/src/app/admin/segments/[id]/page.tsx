"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { coursesApi, testsApi, segmentsApi, ApiError, type Course, type Segment, type Test } from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import { useConfirm } from "@/components/ConfirmProvider";
import { useImageLightbox } from "@/components/ImageLightboxProvider";

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

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.8">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
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

function courseInitials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function CourseRow({ course, onRemove }: { course: Course; onRemove: () => void }) {
  const openImage = useImageLightbox();
  return (
    <div className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden" }}>
      {course.thumbnailUrl ? (
        <div
          onClick={() => openImage(course.thumbnailUrl!, course.title)}
          style={{ position: "relative", height: 80, background: `url(${course.thumbnailUrl}) center/cover`, cursor: "pointer" }}
        >
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,.45))" }} />
        </div>
      ) : (
        <div className="banner-gradient-dark" style={{ position: "relative", height: 80, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            className="banner-gradient-orange"
            style={{ width: 34, height: 34, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}
          >
            {courseInitials(course.title)}
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", fontSize: 13 }}>
        <span style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <Link href={`/admin/courses/${course.id}`} style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {course.title}
          </Link>
          <StatusBadge published={course.published} />
        </span>
        <button onClick={onRemove} title="Remove from this category" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0, flex: "none" }}>
          <TrashIcon />
        </button>
      </div>
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

function TestRow({ test, onRemove }: { test: Test; onRemove: () => void }) {
  return (
    <div className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden" }}>
      <div className="banner-gradient-dark" style={{ position: "relative", height: 80, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          className="banner-gradient-orange"
          style={{ width: 34, height: 34, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}
        >
          {courseInitials(test.title)}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", fontSize: 13 }}>
        <span style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
          <Link href={`/admin/tests/${test.id}`} style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {test.title}
          </Link>
          <StatusBadge published={test.published} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 6,
              background: test.type === "PAID" ? "var(--orange-soft)" : "var(--green-soft)",
              color: test.type === "PAID" ? "var(--orange)" : "var(--green)",
            }}
          >
            {test.type === "PAID" ? "Paid" : "Free"}
          </span>
        </span>
        <button onClick={onRemove} title="Remove from this category" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0, flex: "none" }}>
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function AddTestPicker({ allTests, onPick }: { allTests: Test[]; onPick: (testId: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const matches = useMemo(
    () => allTests.filter((t) => t.title.toLowerCase().includes(search.toLowerCase())).slice(0, 8),
    [allTests, search],
  );

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...smallBtn, marginTop: 10 }}>
        + Add existing test
      </button>
    );
  }

  async function handlePick(testId: string) {
    setAssigningId(testId);
    try {
      await onPick(testId);
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
        placeholder="Search tests by title…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
      />
      {matches.length === 0 ? (
        <p style={{ color: "var(--ink3)", fontSize: 12.5 }}>No matching tests.</p>
      ) : (
        <div style={{ display: "grid", gap: 4, maxHeight: 200, overflowY: "auto" }}>
          {matches.map((t) => (
            <button
              key={t.id}
              disabled={assigningId !== null}
              onClick={() => handlePick(t.id)}
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
                opacity: assigningId !== null && assigningId !== t.id ? 0.5 : 1,
              }}
            >
              <span>{t.title}</span>
              {assigningId === t.id ? (
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
  const confirm = useConfirm();

  const [segment, setSegment] = useState<Segment | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allTests, setAllTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [addingSub, setAddingSub] = useState(false);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [expandedSubTests, setExpandedSubTests] = useState<string | null>(null);
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState("");
  const [savingSub, setSavingSub] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([segmentsApi.get(segmentId), coursesApi.list(), testsApi.list()])
      .then(([s, c, t]) => {
        setSegment(s);
        setAllCourses(c);
        setAllTests(t.filter((test) => !test.courseId));
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
    if (!(await confirm({ message: "Delete this sub-segment? This cannot be undone." }))) return;
    await segmentsApi.removeSubsegment(id);
    load();
  }

  function openEditSub(id: string, name: string) {
    setError(null);
    setEditSubId(id);
    setEditSubName(name);
  }

  async function onUpdateSubsegment(e: React.FormEvent) {
    e.preventDefault();
    if (!editSubId) return;
    setSavingSub(true);
    setError(null);
    try {
      await segmentsApi.updateSubsegment(editSubId, { name: editSubName });
      setEditSubId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to rename sub-segment");
    } finally {
      setSavingSub(false);
    }
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

  async function onAssignTestToSegment(testId: string) {
    await testsApi.update(testId, { segmentId, subsegmentId: undefined });
    await load();
  }

  async function onAssignTestToSubsegment(testId: string, subsegmentId: string) {
    await testsApi.update(testId, { segmentId, subsegmentId });
    await load();
  }

  async function onRemoveTestFromCategory(testId: string) {
    await testsApi.update(testId, { segmentId: null, subsegmentId: null });
    load();
  }

  if (loading) return <div style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></div>;
  if (error || !segment) return <div style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Segment not found"}</p></div>;

  const directCourses = allCourses.filter((c) => c.segmentId === segmentId && !c.subsegmentId);
  const directTests = allTests.filter((t) => t.segmentId === segmentId && !t.subsegmentId);

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px" }}>
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

        {editSubId && (
          <Modal title="Edit sub-segment" onClose={() => setEditSubId(null)}>
            <form onSubmit={onUpdateSubsegment}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Sub-segment name</div>
              <input
                required
                autoFocus
                value={editSubName}
                onChange={(e) => setEditSubName(e.target.value)}
                style={{ ...inputStyle, width: "100%", marginBottom: 14 }}
              />
              <button
                type="submit"
                disabled={savingSub}
                style={{
                  ...smallBtn,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "11px 18px",
                  fontSize: 14,
                  opacity: savingSub ? 0.7 : 1,
                }}
              >
                {savingSub && <Spinner />}
                {savingSub ? "Saving…" : "Save changes"}
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
              const subTests = allTests.filter((t) => t.subsegmentId === sub.id);
              const expanded = expandedSub === sub.id;
              const expandedTests = expandedSubTests === sub.id;
              return (
                <div key={sub.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>
                      {sub.name}{" "}
                      <span style={{ color: "var(--ink3)", fontWeight: 500, fontSize: 12.5 }}>
                        · {subCourses.length} courses · {subTests.length} tests
                      </span>
                    </span>
                    <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <button
                        onClick={() => setExpandedSub(expanded ? null : sub.id)}
                        style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                      >
                        {expanded ? "Hide courses" : "Manage courses"}
                      </button>
                      <button
                        onClick={() => setExpandedSubTests(expandedTests ? null : sub.id)}
                        style={{ background: "none", border: "none", color: "var(--purple)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                      >
                        {expandedTests ? "Hide tests" : "Manage tests"}
                      </button>
                      <button onClick={() => openEditSub(sub.id, sub.name)} title="Edit" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        <EditIcon />
                      </button>
                      <button onClick={() => onDeleteSubsegment(sub.id)} title="Delete" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        <TrashIcon />
                      </button>
                    </span>
                  </div>

                  {expanded && (
                    <div style={{ marginTop: 12 }}>
                      {subCourses.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 12 }}>
                          {subCourses.map((c) => (
                            <CourseRow key={c.id} course={c} onRemove={() => onRemoveFromCategory(c.id)} />
                          ))}
                        </div>
                      )}
                      <AddCoursePicker allCourses={allCourses} onPick={(courseId) => onAssignToSubsegment(courseId, sub.id)} />
                    </div>
                  )}

                  {expandedTests && (
                    <div style={{ marginTop: 12 }}>
                      {subTests.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 12 }}>
                          {subTests.map((t) => (
                            <TestRow key={t.id} test={t} onRemove={() => onRemoveTestFromCategory(t.id)} />
                          ))}
                        </div>
                      )}
                      <AddTestPicker allTests={allTests} onPick={(testId) => onAssignTestToSubsegment(testId, sub.id)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Direct courses — only when this segment has no sub-segments. Once sub-segments
          exist, courses must be assigned to one of them instead of the parent segment. */}
      {segment.subsegments.length === 0 ? (
        <section
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--rl)",
            padding: 20,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
            Courses in {segment.name}
          </div>

          {directCourses.length === 0 ? (
            <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 4 }}>No courses assigned yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 12 }}>
              {directCourses.map((c) => (
                <CourseRow key={c.id} course={c} onRemove={() => onRemoveFromCategory(c.id)} />
              ))}
            </div>
          )}

          <AddCoursePicker allCourses={allCourses} onPick={onAssignToSegment} />
        </section>
      ) : directCourses.length > 0 ? (
        <section
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--rl)",
            padding: 20,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            Courses directly in {segment.name}
          </div>
          <p style={{ color: "var(--ink3)", fontSize: 12.5, marginBottom: 14 }}>
            This segment now has sub-segments — move these into a sub-segment above. New courses can only be added to a sub-segment.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {directCourses.map((c) => (
              <CourseRow key={c.id} course={c} onRemove={() => onRemoveFromCategory(c.id)} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Standalone tests — same direct-vs-subsegment rule as courses above. */}
      {segment.subsegments.length === 0 ? (
        <section
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--rl)",
            padding: 20,
            marginTop: 18,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Tests in {segment.name}</div>

          {directTests.length === 0 ? (
            <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 4 }}>No tests assigned yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 12 }}>
              {directTests.map((t) => (
                <TestRow key={t.id} test={t} onRemove={() => onRemoveTestFromCategory(t.id)} />
              ))}
            </div>
          )}

          <AddTestPicker allTests={allTests} onPick={onAssignTestToSegment} />
        </section>
      ) : directTests.length > 0 ? (
        <section
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--rl)",
            padding: 20,
            marginTop: 18,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Tests directly in {segment.name}</div>
          <p style={{ color: "var(--ink3)", fontSize: 12.5, marginBottom: 14 }}>
            This segment now has sub-segments — move these into a sub-segment above. New tests can only be added to a sub-segment.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {directTests.map((t) => (
              <TestRow key={t.id} test={t} onRemove={() => onRemoveTestFromCategory(t.id)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
