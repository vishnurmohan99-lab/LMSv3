"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { coursesApi, uploadsApi, ApiError, type CourseTree } from "@/lib/api";

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

export default function CourseAuthoringPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const [course, setCourse] = useState<CourseTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterBanner, setNewChapterBanner] = useState<File | null>(null);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState("");
  const [editChapterBanner, setEditChapterBanner] = useState<File | null>(null);
  const [savingChapter, setSavingChapter] = useState(false);

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
    const bannerUrl = newChapterBanner ? await uploadsApi.uploadFile(newChapterBanner) : undefined;
    await coursesApi.createChapter(courseId, { title: newChapterTitle, bannerUrl });
    setNewChapterTitle("");
    setNewChapterBanner(null);
    load();
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

  if (loading) return <main style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></main>;
  if (error || !course) return <main style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Course not found"}</p></main>;

  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px" }}>
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

      <form onSubmit={onAddChapter} style={{ display: "flex", gap: 10, marginTop: 28, marginBottom: 20 }}>
        <input
          placeholder="New chapter title"
          value={newChapterTitle}
          onChange={(e) => setNewChapterTitle(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setNewChapterBanner(e.target.files?.[0] ?? null)}
          style={{ fontSize: 13, alignSelf: "center" }}
          title="Banner image (optional)"
        />
        <button type="submit" style={btnStyle}>Add chapter</button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 18 }}>
        {course.chapters.map((chapter) => {
          const editing = editingChapterId === chapter.id;
          return (
            <div key={chapter.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 20, overflow: "hidden" }}>
              {chapter.bannerUrl ? (
                <div style={{ position: "relative", height: 100, margin: "-20px -20px 16px", background: `url(${chapter.bannerUrl}) center/cover` }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,.45))" }} />
                </div>
              ) : (
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
                      style={{ width: 40, height: 40, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}
                    >
                      {chapter.title.trim().slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                </div>
              )}

              {editing ? (
                <form onSubmit={onSaveChapterEdit} style={{ display: "grid", gap: 10 }}>
                  <input
                    required
                    autoFocus
                    value={editChapterTitle}
                    onChange={(e) => setEditChapterTitle(e.target.value)}
                    style={inputStyle}
                  />
                  <input type="file" accept="image/*" onChange={(e) => setEditChapterBanner(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" disabled={savingChapter} style={{ ...btnStyle, opacity: savingChapter ? 0.7 : 1 }}>
                      {savingChapter ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingChapterId(null)}
                      style={{ background: "none", border: "none", color: "var(--ink3)", fontSize: 13, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>{chapter.title}</h2>
                    <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <Link href={`/faculty/courses/${courseId}/chapters/${chapter.id}`} title="View chapter" style={{ display: "flex" }}>
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
                </>
              )}

            </div>
          );
        })}
      </div>
    </main>
  );
}
