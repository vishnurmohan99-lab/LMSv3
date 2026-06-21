"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  coursesApi,
  segmentsApi,
  uploadsApi,
  usersApi,
  batchesApi,
  batchStatusTypesApi,
  ApiError,
  type CourseTree,
  type Segment,
  type Batch,
  type BatchStatusType,
  type Profile,
} from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
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

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.8">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.8">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  );
}

function chapterInitials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function ChapterBanner({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <div style={{ position: "relative", height: 100, margin: "-20px -20px 16px", background: `url(${url}) center/cover` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,.45))" }} />
      </div>
    );
  }
  return (
    <div className="banner-gradient-dark" style={{ position: "relative", height: 100, margin: "-20px -20px 16px", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          right: -30,
          bottom: -30,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(242,106,27,.35), transparent 70%)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          className="banner-gradient-orange"
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {chapterInitials(name)}
        </div>
      </div>
    </div>
  );
}

export default function AdminCourseAuthoringPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const confirm = useConfirm();

  const [course, setCourse] = useState<CourseTree | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [facultyUsers, setFacultyUsers] = useState<Profile[]>([]);
  const [statusTypes, setStatusTypes] = useState<BatchStatusType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterBanner, setNewChapterBanner] = useState<File | null>(null);
  const [addingChapter, setAddingChapter] = useState(false);

  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState("");
  const [editChapterBanner, setEditChapterBanner] = useState<File | null>(null);
  const [savingChapter, setSavingChapter] = useState(false);

  const [showAddBatch, setShowAddBatch] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchName, setBatchName] = useState("");
  const [batchStatusId, setBatchStatusId] = useState("");
  const [batchStartDate, setBatchStartDate] = useState("");
  const [batchEndDate, setBatchEndDate] = useState("");
  const [batchFacultyId, setBatchFacultyId] = useState("");
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([coursesApi.get(courseId), segmentsApi.list(), batchesApi.list(courseId), usersApi.list(), batchStatusTypesApi.list()])
      .then(([c, s, b, users, statuses]) => {
        setCourse(c);
        setSegments(s);
        setBatches(b);
        setFacultyUsers(users.filter((u) => u.role === "FACULTY"));
        setStatusTypes(statuses);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load course"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [courseId]);

  async function onTogglePublished() {
    if (!course) return;
    const updated = await coursesApi.update(course.id, { published: !course.published });
    setCourse({ ...course, published: updated.published });
  }

  async function onAddChapter(e: React.FormEvent) {
    e.preventDefault();
    if (!newChapterTitle.trim()) return;
    setAddingChapter(true);
    try {
      const bannerUrl = newChapterBanner ? await uploadsApi.uploadFile(newChapterBanner) : undefined;
      await coursesApi.createChapter(courseId, { title: newChapterTitle, bannerUrl });
      setNewChapterTitle("");
      setNewChapterBanner(null);
      setShowAddChapter(false);
      load();
    } finally {
      setAddingChapter(false);
    }
  }

  async function onDeleteChapter(id: string) {
    if (!(await confirm({ message: "Delete this chapter and all its lessons? This cannot be undone." }))) return;
    await coursesApi.removeChapter(id);
    load();
  }

  function openEditChapter(id: string, title: string) {
    setEditingChapterId(id);
    setEditChapterTitle(title);
    setEditChapterBanner(null);
  }

  async function onSaveChapterEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingChapterId) return;
    setSavingChapter(true);
    try {
      const bannerUrl = editChapterBanner ? await uploadsApi.uploadFile(editChapterBanner) : undefined;
      await coursesApi.updateChapter(editingChapterId, { title: editChapterTitle, bannerUrl });
      setEditingChapterId(null);
      load();
    } finally {
      setSavingChapter(false);
    }
  }

  function openAddBatch() {
    setBatchName("");
    setBatchStatusId(statusTypes.find((s) => s.isDefault)?.id ?? statusTypes[0]?.id ?? "");
    setBatchStartDate("");
    setBatchEndDate("");
    setBatchFacultyId("");
    setBatchError(null);
    setShowAddBatch(true);
  }

  function openEditBatch(batch: Batch) {
    setBatchName(batch.name);
    setBatchStatusId(batch.statusId);
    setBatchStartDate(batch.startDate.slice(0, 10));
    setBatchEndDate(batch.endDate ? batch.endDate.slice(0, 10) : "");
    setBatchFacultyId(batch.facultyId ?? "");
    setBatchError(null);
    setEditingBatch(batch);
  }

  async function onSaveBatch(e: React.FormEvent) {
    e.preventDefault();
    setSavingBatch(true);
    setBatchError(null);
    try {
      const data = {
        name: batchName,
        statusId: batchStatusId,
        startDate: new Date(batchStartDate).toISOString(),
        endDate: batchEndDate ? new Date(batchEndDate).toISOString() : undefined,
        facultyId: batchFacultyId || undefined,
      };
      if (editingBatch) {
        await batchesApi.update(editingBatch.id, data);
        setEditingBatch(null);
      } else {
        await batchesApi.create(courseId, data);
        setShowAddBatch(false);
      }
      load();
    } catch (err) {
      setBatchError(err instanceof ApiError ? err.message : "Failed to save batch");
    } finally {
      setSavingBatch(false);
    }
  }

  async function onDeleteBatch(id: string) {
    if (!(await confirm({ message: "Delete this batch? This removes its roster and sessions too. This cannot be undone." }))) return;
    await batchesApi.remove(id);
    load();
  }

  if (loading) return <div style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></div>;
  if (error || !course) return <div style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Course not found"}</p></div>;

  const courseSegment = segments.find((s) => s.id === course.segmentId);
  const courseSubsegment = courseSegment?.subsegments.find((sub) => sub.id === course.subsegmentId);
  const categoryLabel = courseSegment
    ? courseSubsegment
      ? `${courseSegment.name} / ${courseSubsegment.name}`
      : courseSegment.name
    : "Uncategorized";

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--orange)", textTransform: "uppercase", marginBottom: 4 }}>
            Course
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>{course.title}</h1>
          {course.description && <p style={{ color: "var(--ink2)", marginTop: 6 }}>{course.description}</p>}
        </div>
        <button
          onClick={onTogglePublished}
          style={{
            ...btnStyle,
            background: course.published ? "var(--amber-soft)" : "var(--green-soft)",
            color: course.published ? "var(--amber)" : "var(--green)",
          }}
        >
          {course.published ? "Unpublish" : "Publish"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 20,
          padding: "12px 16px",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rm)",
          alignItems: "center",
          fontSize: 13,
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--ink2)" }}>Category:</span>
        <span style={{ color: courseSegment ? "var(--ink)" : "var(--ink3)" }}>{categoryLabel}</span>
        <span style={{ color: "var(--ink3)", marginLeft: "auto" }}>
          Assign this course to a segment from the{" "}
          <Link href="/admin/segments" style={{ color: "var(--orange)", fontWeight: 700 }}>
            Segments page
          </Link>
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Chapters</div>
        <button
          onClick={() => setShowAddChapter(true)}
          style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 7 }}
        >
          <PlusIcon />
          Add chapter
        </button>
      </div>

      {showAddChapter && (
        <Modal title="Add chapter" onClose={() => setShowAddChapter(false)}>
          <form onSubmit={onAddChapter}>
            <input
              required
              autoFocus
              placeholder="Chapter title"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
            />
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>
                Banner image (optional)
              </div>
              <input type="file" accept="image/*" onChange={(e) => setNewChapterBanner(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
            </div>
            <button
              type="submit"
              disabled={addingChapter}
              style={{
                ...btnStyle,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: addingChapter ? 0.7 : 1,
              }}
            >
              {addingChapter && <Spinner />}
              {addingChapter ? "Adding…" : "Add chapter"}
            </button>
          </form>
        </Modal>
      )}

      {editingChapterId && (
        <Modal title="Edit chapter" onClose={() => setEditingChapterId(null)}>
          <form onSubmit={onSaveChapterEdit} style={{ display: "grid", gap: 14 }}>
            <input
              required
              autoFocus
              placeholder="Chapter title"
              value={editChapterTitle}
              onChange={(e) => setEditChapterTitle(e.target.value)}
              style={inputStyle}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>
                Banner image (optional)
              </div>
              <input type="file" accept="image/*" onChange={(e) => setEditChapterBanner(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
            </div>
            <button
              type="submit"
              disabled={savingChapter}
              style={{
                ...btnStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: savingChapter ? 0.7 : 1,
              }}
            >
              {savingChapter && <Spinner />}
              {savingChapter ? "Saving…" : "Save changes"}
            </button>
          </form>
        </Modal>
      )}

      {course.chapters.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No chapters yet — add the first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 18 }}>
          {course.chapters.map((chapter) => (
            <div key={chapter.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 20, overflow: "hidden" }}>
              <ChapterBanner url={chapter.bannerUrl} name={chapter.title} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{chapter.title}</h2>
                <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <Link
                    href={`/admin/courses/${courseId}/chapters/${chapter.id}`}
                    title="View chapter"
                    style={{ display: "flex" }}
                  >
                    <EyeIcon />
                  </Link>
                  <button
                    onClick={() => openEditChapter(chapter.id, chapter.title)}
                    title="Edit chapter"
                    style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <EditIcon />
                  </button>
                  <button
                    onClick={() => onDeleteChapter(chapter.id)}
                    title="Delete chapter"
                    style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <TrashIcon />
                  </button>
                </span>
              </div>

              <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4 }}>
                {chapter.lessons.length} lesson{chapter.lessons.length === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Batches</div>
        <button onClick={openAddBatch} style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 7 }}>
          <PlusIcon />
          Add batch
        </button>
      </div>

      {(showAddBatch || editingBatch) && (
        <Modal title={editingBatch ? "Edit batch" : "Add batch"} onClose={() => (editingBatch ? setEditingBatch(null) : setShowAddBatch(false))}>
          <form onSubmit={onSaveBatch} style={{ display: "grid", gap: 14 }}>
            <input
              required
              autoFocus
              placeholder="Batch name"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              style={inputStyle}
            />
            <select value={batchStatusId} onChange={(e) => setBatchStatusId(e.target.value)} style={inputStyle}>
              {statusTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Start date</div>
                <input
                  required
                  type="date"
                  value={batchStartDate}
                  onChange={(e) => setBatchStartDate(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>End date (optional)</div>
                <input
                  type="date"
                  value={batchEndDate}
                  onChange={(e) => setBatchEndDate(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Assigned faculty (optional)</div>
              <select value={batchFacultyId} onChange={(e) => setBatchFacultyId(e.target.value)} style={{ ...inputStyle, width: "100%" }}>
                <option value="">— None —</option>
                {facultyUsers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.fullName} ({f.email})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={savingBatch}
              style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: savingBatch ? 0.7 : 1 }}
            >
              {savingBatch && <Spinner />}
              {savingBatch ? "Saving…" : editingBatch ? "Save changes" : "Add batch"}
            </button>
            {batchError && <span style={{ color: "var(--red)", fontSize: 12 }}>{batchError}</span>}
          </form>
        </Modal>
      )}

      {batches.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No batches yet — add the first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
          {batches.map((batch) => (
            <div key={batch.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 18, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{batch.name}</div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 4,
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background: "var(--bg)",
                      color: "var(--ink3)",
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: batch.status.color ?? "var(--ink3)" }} />
                    {batch.status.name}
                  </span>
                </div>
                <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Link href={`/admin/courses/${courseId}/batches/${batch.id}`} title="View batch" style={{ display: "flex" }}>
                    <EyeIcon />
                  </Link>
                  <button
                    onClick={() => openEditBatch(batch)}
                    title="Edit batch"
                    style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <EditIcon />
                  </button>
                  <button
                    onClick={() => onDeleteBatch(batch.id)}
                    title="Delete batch"
                    style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <TrashIcon />
                  </button>
                </span>
              </div>

              <div style={{ fontSize: 12, color: "var(--ink2)" }}>
                {new Date(batch.startDate).toLocaleDateString()}
                {batch.endDate ? ` – ${new Date(batch.endDate).toLocaleDateString()}` : ""}
              </div>

              <div style={{ fontSize: 12, color: "var(--ink3)" }}>
                {batch._count?.enrollments ?? 0} student{(batch._count?.enrollments ?? 0) === 1 ? "" : "s"} ·{" "}
                {batch._count?.sessions ?? 0} session{(batch._count?.sessions ?? 0) === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
