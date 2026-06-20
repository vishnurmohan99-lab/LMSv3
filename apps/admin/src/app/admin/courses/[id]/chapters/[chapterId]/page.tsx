"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { coursesApi, uploadsApi, testsApi, ApiError, type CourseTree, type Lesson, type LessonType } from "@/lib/api";
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

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.8">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.8">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

const AVAILABLE_FEATURES = [{ key: "flashcards" as const, label: "Flashcards" }];

function FeaturePicker({
  flashcardsEnabled,
  onToggleFlashcards,
}: {
  flashcardsEnabled: boolean;
  onToggleFlashcards: (next: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          background: flashcardsEnabled ? "var(--orange-soft)" : "var(--bg)",
          color: flashcardsEnabled ? "var(--orange)" : "var(--ink2)",
          border: "1px solid " + (flashcardsEnabled ? "var(--orange-soft)" : "var(--line)"),
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        <SparkleIcon />
        {flashcardsEnabled ? "Flashcards" : "Add feature"}
      </button>
      {open && (
        <div
          className="modal-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 20,
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,.12)",
            padding: 8,
            minWidth: 160,
          }}
        >
          {AVAILABLE_FEATURES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                onToggleFlashcards(!flashcardsEnabled);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "8px 10px",
                background: "none",
                border: "none",
                borderRadius: 7,
                fontSize: 13,
                fontFamily: "inherit",
                cursor: "pointer",
                color: "var(--ink)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {f.label}
              {flashcardsEnabled && <span style={{ color: "var(--orange)", fontWeight: 700 }}>✓</span>}
            </button>
          ))}
          <div style={{ padding: "6px 10px", fontSize: 11, color: "var(--ink3)" }}>More AI features coming soon</div>
        </div>
      )}
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
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>AI features</div>
        <FeaturePicker flashcardsEnabled={flashcardsEnabled} onToggleFlashcards={setFlashcardsEnabled} />
      </div>
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

function LessonTypeBadge({ type }: { type: LessonType }) {
  return <span style={{ color: "var(--ink3)", fontSize: 12 }}>{type}</span>;
}

export default function ChapterDetailPage() {
  const params = useParams<{ id: string; chapterId: string }>();
  const router = useRouter();
  const courseId = params.id;
  const chapterId = params.chapterId;

  const [course, setCourse] = useState<CourseTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddLesson, setShowAddLesson] = useState(false);
  const [showAddTest, setShowAddTest] = useState(false);
  const [newTestTitle, setNewTestTitle] = useState("");
  const [addingTest, setAddingTest] = useState(false);
  const [showEditChapter, setShowEditChapter] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBanner, setEditBanner] = useState<File | null>(null);
  const [savingChapter, setSavingChapter] = useState(false);

  function load() {
    setLoading(true);
    coursesApi
      .get(courseId)
      .then(setCourse)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load chapter"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [courseId]);

  const chapter = course?.chapters.find((c) => c.id === chapterId);

  async function onDeleteLesson(id: string) {
    await coursesApi.removeLesson(id);
    load();
  }

  async function onToggleLessonFlashcards(lesson: Lesson, next: boolean) {
    await coursesApi.updateLesson(lesson.id, { flashcardsEnabled: next });
    load();
  }

  async function onDeleteChapter() {
    await coursesApi.removeChapter(chapterId);
    router.push(`/admin/courses/${courseId}`);
  }

  function openEditChapter() {
    if (!chapter) return;
    setEditTitle(chapter.title);
    setEditBanner(null);
    setShowEditChapter(true);
  }

  async function onSaveChapterEdit(e: React.FormEvent) {
    e.preventDefault();
    setSavingChapter(true);
    try {
      const bannerUrl = editBanner ? await uploadsApi.uploadFile(editBanner) : undefined;
      await coursesApi.updateChapter(chapterId, { title: editTitle, bannerUrl });
      setShowEditChapter(false);
      load();
    } finally {
      setSavingChapter(false);
    }
  }

  if (loading) return <div style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></div>;
  if (error || !course || !chapter) return <div style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Chapter not found"}</p></div>;

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <Link href={`/admin/courses/${courseId}`} style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
        ← Back to {course.title}
      </Link>

      {chapter.bannerUrl ? (
        <div style={{ position: "relative", height: 140, borderRadius: "var(--rl)", marginTop: 16, marginBottom: 18, background: `url(${chapter.bannerUrl}) center/cover` }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "var(--rl)", background: "linear-gradient(transparent 30%, rgba(0,0,0,.55))" }} />
          <h1 style={{ position: "absolute", left: 20, bottom: 16, color: "#fff", fontSize: 24, fontWeight: 800 }}>{chapter.title}</h1>
        </div>
      ) : (
        <div className="banner-gradient-dark" style={{ position: "relative", height: 140, borderRadius: "var(--rl)", marginTop: 16, marginBottom: 18, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              right: -40,
              bottom: -40,
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(242,106,27,.35), transparent 70%)",
            }}
          />
          <h1 style={{ position: "absolute", left: 20, bottom: 16, color: "#fff", fontSize: 24, fontWeight: 800 }}>{chapter.title}</h1>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: "var(--ink3)" }}>
          {chapter.lessons.length} lesson{chapter.lessons.length === 1 ? "" : "s"}
        </div>
        <span style={{ display: "flex", gap: 10 }}>
          <button onClick={openEditChapter} style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)", display: "flex", alignItems: "center", gap: 6 }}>
            <EditIcon /> Edit chapter
          </button>
          <button onClick={onDeleteChapter} style={{ ...btnStyle, background: "var(--red)", display: "flex", alignItems: "center", gap: 6 }}>
            <TrashIcon /> Delete chapter
          </button>
          <button onClick={() => setShowAddTest(true)} style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)", display: "flex", alignItems: "center", gap: 7 }}>
            <PlusIcon /> Add test
          </button>
          <button onClick={() => setShowAddLesson(true)} style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 7 }}>
            <PlusIcon /> Add lesson
          </button>
        </span>
      </div>

      {showAddLesson && (
        <Modal title="Add lesson" onClose={() => setShowAddLesson(false)}>
          <NewLessonForm
            chapterId={chapterId}
            onDone={() => {
              setShowAddLesson(false);
              load();
            }}
          />
        </Modal>
      )}

      {showAddTest && (
        <Modal title="Add test" onClose={() => setShowAddTest(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAddingTest(true);
              try {
                const test = await testsApi.create({ title: newTestTitle, chapterId });
                router.push(`/admin/tests/${test.id}`);
              } finally {
                setAddingTest(false);
              }
            }}
            style={{ display: "grid", gap: 14 }}
          >
            <input required autoFocus placeholder="Test title" value={newTestTitle} onChange={(e) => setNewTestTitle(e.target.value)} style={inputStyle} />
            <button
              type="submit"
              disabled={addingTest}
              style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: addingTest ? 0.7 : 1 }}
            >
              {addingTest && <Spinner />}
              {addingTest ? "Creating…" : "Create test"}
            </button>
          </form>
        </Modal>
      )}

      {showEditChapter && (
        <Modal title="Edit chapter" onClose={() => setShowEditChapter(false)}>
          <form onSubmit={onSaveChapterEdit} style={{ display: "grid", gap: 14 }}>
            <input required autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={inputStyle} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Banner image (optional)</div>
              <input type="file" accept="image/*" onChange={(e) => setEditBanner(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
            </div>
            <button
              type="submit"
              disabled={savingChapter}
              style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: savingChapter ? 0.7 : 1 }}
            >
              {savingChapter && <Spinner />}
              {savingChapter ? "Saving…" : "Save changes"}
            </button>
          </form>
        </Modal>
      )}

      {chapter.lessons.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No lessons yet — add the first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {chapter.lessons.map((lesson) => (
            <div key={lesson.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{lesson.title}</div>
                  <LessonTypeBadge type={lesson.type} />
                </div>
                <button onClick={() => onDeleteLesson(lesson.id)} title="Remove" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <TrashIcon />
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <FeaturePicker
                  flashcardsEnabled={lesson.flashcardsEnabled}
                  onToggleFlashcards={(next) => onToggleLessonFlashcards(lesson, next)}
                />
                {lesson.flashcardsEnabled && (
                  <Link
                    href={`/admin/courses/${courseId}/lessons/${lesson.id}/flashcards`}
                    style={{ color: "var(--orange)", fontWeight: 700, fontSize: 12 }}
                  >
                    Manage
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
