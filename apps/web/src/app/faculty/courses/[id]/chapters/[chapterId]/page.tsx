"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { coursesApi, uploadsApi, testsApi, ApiError, type CourseTree, type Lesson, type LessonType, type Test } from "@/lib/api";
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

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.8">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
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

type FeatureKey = "flashcardsEnabled" | "aiNotesEnabled" | "askMeEnabled" | "summaryDeckEnabled";

const AVAILABLE_FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "flashcardsEnabled", label: "Flashcards" },
  { key: "aiNotesEnabled", label: "AI Notes" },
  { key: "summaryDeckEnabled", label: "Summary Deck" },
  { key: "askMeEnabled", label: "Ask Me" },
];

/** AI Notes is a video-only feature — every other feature works for both video and PDF lessons. */
function excludedFeatureKeys(type: LessonType): FeatureKey[] {
  return type === "VIDEO" ? [] : ["aiNotesEnabled"];
}

/** Parses a .srt subtitle file into plain transcript text (strips indices and timestamps). */
function parseSrtToTranscript(srt: string): string {
  return srt
    .replace(/\r/g, "")
    .split(/\n\n+/)
    .map((block) =>
      block
        .split("\n")
        .filter((line) => !/^\d+$/.test(line.trim()) && !/^\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(line))
        .join(" ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

const MENU_WIDTH = 180;

function FeaturePicker({
  features,
  onToggle,
  excludeKeys = [],
}: {
  features: Record<FeatureKey, boolean>;
  onToggle: (key: FeatureKey, next: boolean) => void;
  excludeKeys?: FeatureKey[];
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visibleFeatures = AVAILABLE_FEATURES.filter((f) => !excludeKeys.includes(f.key));
  const anyEnabled = visibleFeatures.some((f) => features[f.key]);

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
            {visibleFeatures.map((f) => (
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
    summaryDeckEnabled: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyAiFeatureOn = features.aiNotesEnabled || features.askMeEnabled || features.summaryDeckEnabled;

  function onChangeType(next: LessonType) {
    setType(next);
    if (next !== "VIDEO" && features.aiNotesEnabled) {
      setFeatures((f) => ({ ...f, aiNotesEnabled: false }));
    }
  }

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
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginBottom: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16 }}>
      <input required autoFocus placeholder="Lesson title" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      <select value={type} onChange={(e) => onChangeType(e.target.value as LessonType)} style={inputStyle}>
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
        <FeaturePicker
          features={features}
          onToggle={(key, next) => setFeatures((f) => ({ ...f, [key]: next }))}
          excludeKeys={excludedFeatureKeys(type)}
        />
      </div>
      {type === "VIDEO" && anyAiFeatureOn && (
        <div>
          <textarea
            placeholder="Paste the video transcript so AI Notes / Summary Deck / Ask Me can use it"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={5}
            style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical", width: "100%" }}
          />
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink3)" }}>
            Or upload a .srt subtitle file to fill this in automatically:{" "}
            <input
              type="file"
              accept=".srt"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setTranscript(parseSrtToTranscript(await f.text()));
              }}
              style={{ fontSize: 12 }}
            />
          </div>
        </div>
      )}
      <button type="submit" disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.7 : 1 }}>
        {busy ? "Adding…" : "Add lesson"}
      </button>
      {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
    </form>
  );
}

function LessonPreview({ lesson }: { lesson: Lesson }) {
  if (lesson.type === "VIDEO") {
    return lesson.contentUrl ? (
      <video controls src={lesson.contentUrl} style={{ width: "100%", borderRadius: 8, background: "#000" }} />
    ) : (
      <p style={{ fontSize: 12, color: "var(--ink3)" }}>No video uploaded yet.</p>
    );
  }
  if (lesson.type === "PDF") {
    return lesson.contentUrl ? (
      <iframe src={lesson.contentUrl} style={{ width: "100%", height: 320, border: "1px solid var(--line)", borderRadius: 8 }} />
    ) : (
      <p style={{ fontSize: 12, color: "var(--ink3)" }}>No PDF uploaded yet.</p>
    );
  }
  if (lesson.type === "LIVE") {
    return (
      <p style={{ fontSize: 12, color: "var(--ink2)" }}>
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
  onCancel,
}: {
  lesson: Lesson;
  onSave: (data: { title?: string; contentUrl?: string; liveAt?: string; transcript?: string }) => Promise<void>;
  onCancel: () => void;
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
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, marginTop: 4, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      {(lesson.type === "VIDEO" || lesson.type === "PDF") && (
        <div>
          <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 6 }}>
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
        <div>
          <textarea
            placeholder="Paste the video transcript so AI Notes / Summary Deck / Ask Me can use it"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={5}
            style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical", width: "100%" }}
          />
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink3)" }}>
            Or upload a .srt subtitle file to fill this in automatically:{" "}
            <input
              type="file"
              accept=".srt"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setTranscript(parseSrtToTranscript(await f.text()));
              }}
              style={{ fontSize: 12 }}
            />
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onCancel} style={{ background: "none", border: "none", color: "var(--ink3)", fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
      {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
    </form>
  );
}

function LessonCard({
  lesson,
  courseId,
  onDelete,
  onToggleFeature,
  onUpdate,
  moveControls,
  order,
}: {
  lesson: Lesson;
  courseId: string;
  onDelete: () => void;
  onToggleFeature: (key: FeatureKey, next: boolean) => void;
  onUpdate: (data: { title?: string; contentUrl?: string; liveAt?: string; transcript?: string }) => Promise<void>;
  moveControls?: React.ReactNode;
  order?: number;
}) {
  const [viewing, setViewing] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 18, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
            {order !== undefined && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "var(--bg)", color: "var(--ink3)", flex: "none" }}>
                {order}
              </span>
            )}
            {lesson.title}
          </div>
          <span style={{ color: "var(--ink3)", fontSize: 12 }}>{lesson.type}</span>
        </div>
        <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {moveControls}
          <button
            onClick={() => setViewing((v) => !v)}
            title="View lesson"
            style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <EyeIcon />
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            title="Edit lesson"
            style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <EditIcon />
          </button>
          <button onClick={onDelete} title="Delete lesson" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <TrashIcon />
          </button>
        </span>
      </div>

      <div style={{ fontSize: 12, color: lessonContentReady(lesson) ? "var(--ink2)" : "var(--amber)" }}>
        {lessonContentStatus(lesson)}
      </div>

      {(lesson.flashcardsEnabled || (lesson.aiNotesEnabled && lesson.type === "VIDEO") || lesson.askMeEnabled || lesson.summaryDeckEnabled) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {lesson.flashcardsEnabled && (
            <FeatureBadge label="Flashcards" href={`/faculty/courses/${courseId}/lessons/${lesson.id}/flashcards`} />
          )}
          {lesson.aiNotesEnabled && lesson.type === "VIDEO" && (
            <FeatureBadge label="AI Notes" href={`/faculty/courses/${courseId}/lessons/${lesson.id}/notes`} />
          )}
          {lesson.summaryDeckEnabled && (
            <FeatureBadge label="Summary Deck" href={`/faculty/courses/${courseId}/lessons/${lesson.id}/summary-deck`} />
          )}
          {lesson.askMeEnabled && <FeatureBadge label="Ask Me" />}
        </div>
      )}

      <FeaturePicker
        features={{
          flashcardsEnabled: lesson.flashcardsEnabled,
          aiNotesEnabled: lesson.aiNotesEnabled,
          askMeEnabled: lesson.askMeEnabled,
          summaryDeckEnabled: lesson.summaryDeckEnabled,
        }}
        onToggle={onToggleFeature}
        excludeKeys={excludedFeatureKeys(lesson.type)}
      />

      {viewing && <LessonPreview lesson={lesson} />}

      {editing && (
        <EditLessonForm
          lesson={lesson}
          onSave={async (data) => {
            await onUpdate(data);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

type ChapterTest = CourseTree["chapters"][number]["tests"][number];
type ContentItem = { kind: "lesson"; id: string; order: number; data: Lesson } | { kind: "test"; id: string; order: number; data: ChapterTest };

function AttachTestPanel({
  courseId,
  chapterId,
  onAttached,
}: {
  courseId: string;
  chapterId: string;
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
    <div style={{ display: "grid", gap: 10, marginTop: 10, marginBottom: 16, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16 }}>
      <input placeholder="Search tests…" value={query} onChange={(e) => setQuery(e.target.value)} style={inputStyle} />
      {loading ? (
        <p style={{ color: "var(--ink2)", fontSize: 13 }}>Loading tests…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--ink2)", fontSize: 13 }}>No unattached tests found. Create one instead, or detach it from its current chapter/course first.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, maxHeight: 280, overflowY: "auto" }}>
          {filtered.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg)", borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                  {t._count?.testQuestions ?? 0} question{(t._count?.testQuestions ?? 0) === 1 ? "" : "s"} · {t.published ? "Published" : "Draft"}
                </div>
              </div>
              <button
                onClick={() => onAttach(t.id)}
                disabled={attachingId === t.id}
                style={{ ...btnStyle, background: "var(--card)", color: "var(--ink2)", border: "1px solid var(--line)", opacity: attachingId === t.id ? 0.6 : 1 }}
              >
                {attachingId === t.id ? "Attaching…" : "Attach"}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
    </div>
  );
}

export default function FacultyChapterDetailPage() {
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
  const [editing, setEditing] = useState(false);
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
    load();
  }

  async function onDetachTest(testId: string) {
    if (!(await confirm({ message: "Remove this test from the chapter? The test itself won't be deleted." }))) return;
    await testsApi.update(testId, { chapterId: null });
    load();
  }

  async function onMoveContentItem(items: ContentItem[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await Promise.all(
      reordered.map((item, i) =>
        item.order === i ? Promise.resolve() : item.kind === "lesson" ? coursesApi.updateLesson(item.id, { order: i }) : testsApi.update(item.id, { order: i }),
      ),
    );
    load();
  }

  async function onDeleteChapter() {
    if (!(await confirm({ message: "Delete this chapter and all its lessons? This cannot be undone." }))) return;
    await coursesApi.removeChapter(chapterId);
    router.push(`/faculty/courses/${courseId}`);
  }

  function openEdit() {
    if (!chapter) return;
    setEditTitle(chapter.title);
    setEditBanner(null);
    setEditing(true);
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSavingChapter(true);
    try {
      const bannerUrl = editBanner ? await uploadsApi.uploadFile(editBanner) : undefined;
      await coursesApi.updateChapter(chapterId, { title: editTitle, bannerUrl });
      setEditing(false);
      load();
    } finally {
      setSavingChapter(false);
    }
  }

  if (loading) return <main style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></main>;
  if (error || !course || !chapter) return <main style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Chapter not found"}</p></main>;

  const combinedItems: ContentItem[] = [
    ...chapter.lessons.map((l): ContentItem => ({ kind: "lesson", id: l.id, order: l.order, data: l })),
    ...chapter.tests.map((t): ContentItem => ({ kind: "test", id: t.id, order: t.order, data: t })),
  ].sort((a, b) => a.order - b.order);

  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <Link href={`/faculty/courses/${courseId}`} style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13 }}>
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

      {editing && (
        <form onSubmit={onSaveEdit} style={{ display: "grid", gap: 10, marginBottom: 20, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16 }}>
          <input required autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={inputStyle} />
          <input type="file" accept="image/*" onChange={(e) => setEditBanner(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={savingChapter} style={{ ...btnStyle, opacity: savingChapter ? 0.7 : 1 }}>
              {savingChapter ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: "var(--ink3)", fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: "var(--ink3)" }}>
          {chapter.lessons.length} lesson{chapter.lessons.length === 1 ? "" : "s"}
        </div>
        <span style={{ display: "flex", gap: 10 }}>
          <button onClick={openEdit} style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)", display: "flex", alignItems: "center", gap: 6 }}>
            <EditIcon /> Edit chapter
          </button>
          <button onClick={onDeleteChapter} style={{ ...btnStyle, background: "var(--red)", display: "flex", alignItems: "center", gap: 6 }}>
            <TrashIcon /> Delete chapter
          </button>
          <button onClick={() => setShowAttachTest((s) => !s)} style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)" }}>
            {showAttachTest ? "Close" : "+ Attach existing test"}
          </button>
          <button onClick={() => setShowAddTest((s) => !s)} style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)" }}>
            {showAddTest ? "Close" : "+ Create new test"}
          </button>
          <button onClick={() => setShowAddLesson((s) => !s)} style={btnStyle}>
            {showAddLesson ? "Close" : "+ Add lesson"}
          </button>
        </span>
      </div>

      {showAddTest && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setAddingTest(true);
            try {
              const test = await testsApi.create({ title: newTestTitle, chapterId });
              router.push(`/faculty/tests/${test.id}`);
            } finally {
              setAddingTest(false);
            }
          }}
          style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 16 }}
        >
          <input
            required
            autoFocus
            placeholder="Test title"
            value={newTestTitle}
            onChange={(e) => setNewTestTitle(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="submit" disabled={addingTest} style={{ ...btnStyle, opacity: addingTest ? 0.7 : 1 }}>
            {addingTest ? "Creating…" : "Create test"}
          </button>
        </form>
      )}

      {showAttachTest && (
        <AttachTestPanel
          courseId={courseId}
          chapterId={chapterId}
          onAttached={() => {
            setShowAttachTest(false);
            load();
          }}
        />
      )}

      {showAddLesson && (
        <NewLessonForm
          chapterId={chapterId}
          onDone={() => {
            setShowAddLesson(false);
            load();
          }}
        />
      )}

      {combinedItems.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No lessons or tests yet — add one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
          {combinedItems.map((item, i) => {
            const moveControls = (
              <span style={{ display: "flex", gap: 2 }}>
                <button
                  onClick={() => onMoveContentItem(combinedItems, i, -1)}
                  disabled={i === 0}
                  title="Move up"
                  style={{ display: "flex", background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", padding: 2, opacity: i === 0 ? 0.35 : 1 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="2">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => onMoveContentItem(combinedItems, i, 1)}
                  disabled={i === combinedItems.length - 1}
                  title="Move down"
                  style={{
                    display: "flex",
                    background: "none",
                    border: "none",
                    cursor: i === combinedItems.length - 1 ? "default" : "pointer",
                    padding: 2,
                    opacity: i === combinedItems.length - 1 ? 0.35 : 1,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="2">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                </button>
              </span>
            );

            return item.kind === "lesson" ? (
              <LessonCard
                key={item.id}
                lesson={item.data}
                courseId={courseId}
                onDelete={() => onDeleteLesson(item.data.id)}
                onToggleFeature={(key, next) => onToggleLessonFeature(item.data, key, next)}
                onUpdate={(data) => onUpdateLesson(item.data.id, data)}
                moveControls={moveControls}
                order={i + 1}
              />
            ) : (
              <div key={item.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 7,
                      background: item.data.published ? "var(--green-soft)" : "var(--amber-soft)",
                      color: item.data.published ? "var(--green)" : "var(--amber)",
                    }}
                  >
                    {item.data.published ? "Published" : "Draft"}
                  </span>
                  <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {moveControls}
                    <button onClick={() => onDetachTest(item.data.id)} title="Detach from chapter" style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      <TrashIcon />
                    </button>
                  </span>
                </div>
                <Link href={`/faculty/tests/${item.data.id}`} style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "var(--bg)", color: "var(--ink3)", flex: "none" }}>
                    {i + 1}
                  </span>
                  {item.data.title}
                </Link>
                <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 4 }}>Test</div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
