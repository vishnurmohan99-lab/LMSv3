"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { coursesApi, uploadsApi, ApiError, type CourseTree, type LessonType } from "@/lib/api";

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

function NewLessonForm({ chapterId, onAdded }: { chapterId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LessonType>("VIDEO");
  const [liveAt, setLiveAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
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
      });
      setTitle("");
      setFile(null);
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add lesson");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
      <input required placeholder="Lesson title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
      <select value={type} onChange={(e) => setType(e.target.value as LessonType)} style={inputStyle}>
        <option value="VIDEO">Video</option>
        <option value="PDF">PDF</option>
        <option value="LIVE">Live class</option>
        <option value="FLASHCARD">Flashcard</option>
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
      <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.7 : 1 }}>
        {busy ? "Adding…" : "Add lesson"}
      </button>
      {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
    </form>
  );
}

export default function CourseAuthoringPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const [course, setCourse] = useState<CourseTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState("");

  function load() {
    setLoading(true);
    coursesApi
      .get(courseId)
      .then(setCourse)
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
    await coursesApi.createChapter(courseId, { title: newChapterTitle });
    setNewChapterTitle("");
    load();
  }

  async function onDeleteChapter(id: string) {
    await coursesApi.removeChapter(id);
    load();
  }

  async function onDeleteLesson(id: string) {
    await coursesApi.removeLesson(id);
    load();
  }

  if (loading) return <main style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></main>;
  if (error || !course) return <main style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Course not found"}</p></main>;

  return (
    <main style={{ padding: 40, maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>{course.title}</h1>
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

      <form onSubmit={onAddChapter} style={{ display: "flex", gap: 10, marginTop: 28, marginBottom: 20 }}>
        <input
          placeholder="New chapter title"
          value={newChapterTitle}
          onChange={(e) => setNewChapterTitle(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="submit" style={btnStyle}>Add chapter</button>
      </form>

      <div style={{ display: "grid", gap: 16 }}>
        {course.chapters.map((chapter) => (
          <div key={chapter.id} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{chapter.title}</h2>
              <button onClick={() => onDeleteChapter(chapter.id)} style={{ ...btnStyle, background: "var(--red)", padding: "6px 12px", fontSize: 12 }}>
                Delete chapter
              </button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {chapter.lessons.map((lesson) => (
                <div key={lesson.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, fontSize: 13 }}>
                  <span>
                    <b>{lesson.title}</b> <span style={{ color: "var(--ink3)" }}>· {lesson.type}</span>
                  </span>
                  <button onClick={() => onDeleteLesson(lesson.id)} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 12 }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <NewLessonForm chapterId={chapter.id} onAdded={load} />
          </div>
        ))}
      </div>
    </main>
  );
}
