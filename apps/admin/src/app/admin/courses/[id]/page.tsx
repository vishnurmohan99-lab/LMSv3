"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { coursesApi, segmentsApi, uploadsApi, ApiError, type CourseTree, type LessonType, type Segment } from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";

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

function NewLessonForm({ chapterId, onDone }: { chapterId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LessonType>("VIDEO");
  const [liveAt, setLiveAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [flashcardsEnabled, setFlashcardsEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      let contentUrl: string | undefined;
      if ((type === "VIDEO" || type === "PDF") && file) {
        contentUrl = await uploadsApi.uploadFile(file);
      }
      await coursesApi.createLesson(chapterId, {
        title,
        type,
        contentUrl,
        liveAt: type === "LIVE" && liveAt ? new Date(liveAt).toISOString() : undefined,
        flashcardsEnabled,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add lesson");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
      <input required autoFocus placeholder="Lesson title" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      <select value={type} onChange={(e) => setType(e.target.value as LessonType)} style={inputStyle}>
        <option value="VIDEO">Video</option>
        <option value="PDF">PDF</option>
        <option value="LIVE">Live class</option>
      </select>
      {(type === "VIDEO" || type === "PDF") && (
        <input
          type="file"
          accept={type === "VIDEO" ? "video/mp4,video/webm,video/quicktime" : "application/pdf"}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ fontSize: 13 }}
        />
      )}
      {type === "LIVE" && (
        <input type="datetime-local" value={liveAt} onChange={(e) => setLiveAt(e.target.value)} style={inputStyle} />
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink2)" }}>
        <input type="checkbox" checked={flashcardsEnabled} onChange={(e) => setFlashcardsEnabled(e.target.checked)} />
        Enable Flashcards for this lesson
      </label>
      <button
        type="submit"
        disabled={busy}
        style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.7 : 1 }}
      >
        {busy && <Spinner />}
        {busy ? (type === "VIDEO" || type === "PDF" ? "Uploading…" : "Adding…") : "Add lesson"}
      </button>
      {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
    </form>
  );
}

export default function AdminCourseAuthoringPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const [course, setCourse] = useState<CourseTree | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterBanner, setNewChapterBanner] = useState<File | null>(null);
  const [addingChapter, setAddingChapter] = useState(false);

  const [addLessonChapterId, setAddLessonChapterId] = useState<string | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);

  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState("");
  const [editChapterBanner, setEditChapterBanner] = useState<File | null>(null);
  const [savingChapter, setSavingChapter] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([coursesApi.get(courseId), segmentsApi.list()])
      .then(([c, s]) => {
        setCourse(c);
        setSegments(s);
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

  async function onDeleteLesson(id: string) {
    await coursesApi.removeLesson(id);
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
    <div style={{ padding: "30px 40px 60px" }}>
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

      {addLessonChapterId && (
        <Modal title="Add lesson" onClose={() => setAddLessonChapterId(null)}>
          <NewLessonForm
            chapterId={addLessonChapterId}
            onDone={() => {
              setAddLessonChapterId(null);
              load();
            }}
          />
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
          {course.chapters.map((chapter) => {
            const expanded = expandedChapterId === chapter.id;
            return (
              <div key={chapter.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 20, overflow: "hidden" }}>
                <ChapterBanner url={chapter.bannerUrl} name={chapter.title} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700 }}>{chapter.title}</h2>
                  <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <button
                      onClick={() => setExpandedChapterId(expanded ? null : chapter.id)}
                      title={expanded ? "Hide lessons" : "View lessons"}
                      style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      <EyeIcon />
                    </button>
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

                {expanded && (
                  <>
                    {chapter.lessons.length > 0 && (
                      <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                        {chapter.lessons.map((lesson) => (
                          <div key={lesson.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, fontSize: 13 }}>
                            <span>
                              <b>{lesson.title}</b> <span style={{ color: "var(--ink3)" }}>· {lesson.type}</span>
                            </span>
                            <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              {lesson.flashcardsEnabled && (
                                <Link
                                  href={`/admin/courses/${courseId}/lessons/${lesson.id}/flashcards`}
                                  style={{ color: "var(--orange)", fontWeight: 700, fontSize: 12 }}
                                >
                                  Manage flashcards
                                </Link>
                              )}
                              <button onClick={() => onDeleteLesson(lesson.id)} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 12 }}>
                                Remove
                              </button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => setAddLessonChapterId(chapter.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginTop: 10,
                        padding: "8px 14px",
                        background: "var(--bg)",
                        color: "var(--ink2)",
                        border: "1px solid var(--line)",
                        borderRadius: 9,
                        fontSize: 12.5,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      + Add lesson
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
