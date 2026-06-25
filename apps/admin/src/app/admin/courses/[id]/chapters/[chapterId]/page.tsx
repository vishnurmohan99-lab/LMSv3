"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { coursesApi, uploadsApi, testsApi, ApiError, type CourseTree, type Lesson, type LessonType, type Test } from "@/lib/api";
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

type FeatureKey = "flashcardsEnabled" | "aiNotesEnabled" | "askMeEnabled";

const AVAILABLE_FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "flashcardsEnabled", label: "Flashcards" },
  { key: "aiNotesEnabled", label: "AI Notes" },
  { key: "askMeEnabled", label: "Ask Me" },
];

const MENU_WIDTH = 180;

function FeaturePicker({
  features,
  onToggle,
}: {
  features: Record<FeatureKey, boolean>;
  onToggle: (key: FeatureKey, next: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const anyEnabled = AVAILABLE_FEATURES.some((f) => features[f.key]);

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
      setPos({ top: rect.bottom + 6, left });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          background: anyEnabled ? "var(--orange-soft)" : "var(--bg)",
          color: anyEnabled ? "var(--orange)" : "var(--ink2)",
          border: "1px solid " + (anyEnabled ? "var(--orange-soft)" : "var(--line)"),
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        <SparkleIcon />
        {anyEnabled ? "Edit features" : "Add feature"}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="modal-panel"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              zIndex: 300,
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              boxShadow: "0 12px 32px rgba(0,0,0,.18)",
              padding: 8,
              minWidth: MENU_WIDTH,
            }}
          >
            {AVAILABLE_FEATURES.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  onToggle(f.key, !features[f.key]);
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
                {features[f.key] && <span style={{ color: "var(--orange)", fontWeight: 700 }}>✓</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

function FeatureBadge({ label, href }: { label: string; href?: string }) {
  const content = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 9px",
        background: "var(--orange-soft)",
        color: "var(--orange)",
        borderRadius: 7,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function lessonContentStatus(lesson: Lesson): string {
  if (lesson.type === "VIDEO") return lesson.contentUrl ? "Video uploaded" : "No video uploaded yet";
  if (lesson.type === "PDF") return lesson.contentUrl ? "PDF uploaded" : "No PDF uploaded yet";
  if (lesson.type === "LIVE") return lesson.liveAt ? new Date(lesson.liveAt).toLocaleString() : "Not scheduled yet";
  return "";
}

function lessonContentReady(lesson: Lesson): boolean {
  if (lesson.type === "VIDEO" || lesson.type === "PDF") return !!lesson.contentUrl;
  if (lesson.type === "LIVE") return !!lesson.liveAt;
  return true;
}

function NewLessonForm({ chapterId, onDone }: { chapterId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LessonType>("VIDEO");
  const [liveAt, setLiveAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>({
    flashcardsEnabled: false,
    aiNotesEnabled: false,
    askMeEnabled: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyAiFeatureOn = features.aiNotesEnabled || features.askMeEnabled;

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
        transcript: type === "VIDEO" && transcript ? transcript : undefined,
        ...features,
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
        <FeaturePicker features={features} onToggle={(key, next) => setFeatures((f) => ({ ...f, [key]: next }))} />
      </div>
      {type === "VIDEO" && anyAiFeatureOn && (
        <textarea
          placeholder="Paste the video transcript so AI Notes / Ask Me can use it"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={5}
          style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
        />
      )}
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

function LessonPreview({ lesson }: { lesson: Lesson }) {
  if (lesson.type === "VIDEO") {
    return lesson.contentUrl ? (
      <video controls src={lesson.contentUrl} style={{ width: "100%", borderRadius: 8, background: "#000" }} />
    ) : (
      <p style={{ fontSize: 13, color: "var(--ink3)" }}>No video uploaded yet.</p>
    );
  }
  if (lesson.type === "PDF") {
    return lesson.contentUrl ? (
      <iframe src={lesson.contentUrl} style={{ width: "100%", height: 400, border: "1px solid var(--line)", borderRadius: 8 }} />
    ) : (
      <p style={{ fontSize: 13, color: "var(--ink3)" }}>No PDF uploaded yet.</p>
    );
  }
  if (lesson.type === "LIVE") {
    return (
      <p style={{ fontSize: 13, color: "var(--ink2)" }}>
        {lesson.liveAt ? `Scheduled for ${new Date(lesson.liveAt).toLocaleString()}` : "Not scheduled yet."}
      </p>
    );
  }
  return null;
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditLessonForm({
  lesson,
  onSave,
}: {
  lesson: Lesson;
  onSave: (data: { title?: string; contentUrl?: string; liveAt?: string; transcript?: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [file, setFile] = useState<File | null>(null);
  const [liveAt, setLiveAt] = useState(lesson.liveAt ? toLocalDatetimeValue(lesson.liveAt) : "");
  const [transcript, setTranscript] = useState(lesson.transcript ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let contentUrl: string | undefined;
      if ((lesson.type === "VIDEO" || lesson.type === "PDF") && file) {
        contentUrl = await uploadsApi.uploadFile(file);
      }
      await onSave({
        title,
        contentUrl,
        liveAt: lesson.type === "LIVE" && liveAt ? new Date(liveAt).toISOString() : undefined,
        transcript: lesson.type === "VIDEO" ? transcript : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update lesson");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
      <input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      {(lesson.type === "VIDEO" || lesson.type === "PDF") && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>
            {lesson.contentUrl ? "Replace file (optional)" : "Upload file"}
          </div>
          <input
            type="file"
            accept={lesson.type === "VIDEO" ? "video/mp4,video/webm,video/quicktime" : "application/pdf"}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 13 }}
          />
        </div>
      )}
      {lesson.type === "LIVE" && (
        <input type="datetime-local" value={liveAt} onChange={(e) => setLiveAt(e.target.value)} style={inputStyle} />
      )}
      {lesson.type === "VIDEO" && (
        <textarea
          placeholder="Paste the video transcript so AI Notes / Ask Me can use it"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={5}
          style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
        />
      )}
      <button
        type="submit"
        disabled={saving}
        style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1 }}
      >
        {saving && <Spinner />}
        {saving ? "Saving…" : "Save changes"}
      </button>
      {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
    </form>
  );
}

function AttachTestModal({
  courseId,
  chapterId,
  onClose,
  onAttached,
}: {
  courseId: string;
  chapterId: string;
  onClose: () => void;
  onAttached: () => void;
}) {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    testsApi
      .list()
      .then((all) => setTests(all.filter((t) => !t.chapterId && (!t.courseId || t.courseId === courseId))))
      .catch(() => setError("Failed to load tests"))
      .finally(() => setLoading(false));
  }, [courseId]);

  const filtered = tests.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()));

  async function onAttach(testId: string) {
    setAttachingId(testId);
    setError(null);
    try {
      await testsApi.update(testId, { chapterId });
      onAttached();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to attach test");
    } finally {
      setAttachingId(null);
    }
  }

  return (
    <Modal title="Attach an existing test" onClose={onClose}>
      <div style={{ display: "grid", gap: 14 }}>
        <input
          placeholder="Search tests…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={inputStyle}
        />
        {loading ? (
          <p style={{ color: "var(--ink2)", fontSize: 13 }}>Loading tests…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: "var(--ink2)", fontSize: 13 }}>No unattached tests found. Create one instead, or detach it from its current chapter/course first.</p>
        ) : (
          <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
            {filtered.map((t) => (
              <div
                key={t.id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg)", borderRadius: 10 }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                    {t._count?.testQuestions ?? 0} question{(t._count?.testQuestions ?? 0) === 1 ? "" : "s"} · {t.published ? "Published" : "Draft"}
                  </div>
                </div>
                <button
                  onClick={() => onAttach(t.id)}
                  disabled={attachingId === t.id}
                  style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)", border: "1px solid var(--line)", opacity: attachingId === t.id ? 0.6 : 1 }}
                >
                  {attachingId === t.id ? "Attaching…" : "Attach"}
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
      </div>
    </Modal>
  );
}

export default function ChapterDetailPage() {
  const params = useParams<{ id: string; chapterId: string }>();
  const router = useRouter();
  const courseId = params.id;
  const chapterId = params.chapterId;
  const confirm = useConfirm();
  const openImage = useImageLightbox();

  const [course, setCourse] = useState<CourseTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddLesson, setShowAddLesson] = useState(false);
  const [showAddTest, setShowAddTest] = useState(false);
  const [showAttachTest, setShowAttachTest] = useState(false);
  const [newTestTitle, setNewTestTitle] = useState("");
  const [addingTest, setAddingTest] = useState(false);
  const [showEditChapter, setShowEditChapter] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBanner, setEditBanner] = useState<File | null>(null);
  const [savingChapter, setSavingChapter] = useState(false);
  const [viewingLesson, setViewingLesson] = useState<Lesson | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

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
    if (!(await confirm({ message: "Delete this lesson? This cannot be undone." }))) return;
    await coursesApi.removeLesson(id);
    load();
  }

  async function onToggleLessonFeature(lesson: Lesson, key: FeatureKey, next: boolean) {
    await coursesApi.updateLesson(lesson.id, { [key]: next });
    load();
  }

  async function onUpdateLesson(lessonId: string, data: { title?: string; contentUrl?: string; liveAt?: string; transcript?: string }) {
    await coursesApi.updateLesson(lessonId, data);
    setEditingLesson(null);
    load();
  }

  async function onDetachTest(testId: string) {
    if (!(await confirm({ message: "Remove this test from the chapter? The test itself won't be deleted." }))) return;
    await testsApi.update(testId, { chapterId: null });
    load();
  }

  async function onDeleteChapter() {
    if (!(await confirm({ message: "Delete this chapter and all its lessons? This cannot be undone." }))) return;
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
        <div
          onClick={() => openImage(chapter.bannerUrl!, chapter.title)}
          style={{ position: "relative", height: 140, borderRadius: "var(--rl)", marginTop: 16, marginBottom: 18, background: `url(${chapter.bannerUrl}) center/cover`, cursor: "pointer" }}
        >
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
          <button onClick={() => setShowAttachTest(true)} style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)", display: "flex", alignItems: "center", gap: 7 }}>
            <PlusIcon /> Attach existing test
          </button>
          <button onClick={() => setShowAddTest(true)} style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)", display: "flex", alignItems: "center", gap: 7 }}>
            <PlusIcon /> Create new test
          </button>
          <button onClick={() => setShowAddLesson(true)} style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 7 }}>
            <PlusIcon /> Add lesson
          </button>
        </span>
      </div>

      {showAddLesson && (
        <Modal title="Add lesson" onClose={() => setShowAddLesson(false)} maxWidth={560}>
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

      {showAttachTest && (
        <AttachTestModal
          courseId={courseId}
          chapterId={chapterId}
          onClose={() => setShowAttachTest(false)}
          onAttached={() => {
            setShowAttachTest(false);
            load();
          }}
        />
      )}

      {chapter.tests.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 10 }}>
            Tests ({chapter.tests.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {chapter.tests.map((t) => (
              <div key={t.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 7,
                      background: t.published ? "var(--green-soft)" : "var(--amber-soft)",
                      color: t.published ? "var(--green)" : "var(--amber)",
                    }}
                  >
                    {t.published ? "Published" : "Draft"}
                  </span>
                  <button onClick={() => onDetachTest(t.id)} title="Detach from chapter" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <TrashIcon />
                  </button>
                </div>
                <Link href={`/admin/tests/${t.id}`} style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>
                  {t.title}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewingLesson && (
        <Modal title={viewingLesson.title} onClose={() => setViewingLesson(null)} maxWidth={680}>
          <LessonPreview lesson={viewingLesson} />
        </Modal>
      )}

      {editingLesson && (
        <Modal title="Edit lesson" onClose={() => setEditingLesson(null)} maxWidth={560}>
          <EditLessonForm lesson={editingLesson} onSave={(data) => onUpdateLesson(editingLesson.id, data)} />
        </Modal>
      )}

      {chapter.lessons.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No lessons yet — add the first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
          {chapter.lessons.map((lesson) => (
            <div key={lesson.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 18, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{lesson.title}</div>
                  <LessonTypeBadge type={lesson.type} />
                </div>
                <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button
                    onClick={() => setViewingLesson(lesson)}
                    title="View lesson"
                    style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <EyeIcon />
                  </button>
                  <button
                    onClick={() => setEditingLesson(lesson)}
                    title="Edit lesson"
                    style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <EditIcon />
                  </button>
                  <button onClick={() => onDeleteLesson(lesson.id)} title="Delete lesson" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <TrashIcon />
                  </button>
                </span>
              </div>

              <div style={{ fontSize: 12, color: lessonContentReady(lesson) ? "var(--ink2)" : "var(--amber)" }}>
                {lessonContentStatus(lesson)}
              </div>

              {(lesson.flashcardsEnabled || lesson.aiNotesEnabled || lesson.askMeEnabled) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {lesson.flashcardsEnabled && (
                    <FeatureBadge label="Flashcards" href={`/admin/courses/${courseId}/lessons/${lesson.id}/flashcards`} />
                  )}
                  {lesson.aiNotesEnabled && (
                    <FeatureBadge label="AI Notes" href={`/admin/courses/${courseId}/lessons/${lesson.id}/notes`} />
                  )}
                  {lesson.askMeEnabled && <FeatureBadge label="Ask Me" />}
                </div>
              )}

              <FeaturePicker
                features={{
                  flashcardsEnabled: lesson.flashcardsEnabled,
                  aiNotesEnabled: lesson.aiNotesEnabled,
                  askMeEnabled: lesson.askMeEnabled,
                }}
                onToggle={(key, next) => onToggleLessonFeature(lesson, key, next)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
