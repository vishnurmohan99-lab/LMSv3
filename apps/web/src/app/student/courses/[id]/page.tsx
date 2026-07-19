"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { coursesApi, flashcardsApi, ApiError, type Chapter, type CourseTree, type Lesson } from "@/lib/api";
import FlashcardReview from "@/components/FlashcardReview";
import SummaryDeckReview from "@/components/SummaryDeckReview";
import CheatSheetReview from "@/components/CheatSheetReview";
import LessonNotes from "@/components/LessonNotes";
import AskMeChat from "@/components/AskMeChat";

// S2 sidebar type chips (36×24 mono squares). Colours are per-type from the design
// tokens; a locked row greys the chip regardless of type.
const CHIP_META: Record<string, { label: string; bg: string; ink: string; meta: string }> = {
  VIDEO: { label: "VID", bg: "var(--purple-soft)", ink: "var(--purple-ink)", meta: "Video" },
  PDF: { label: "PDF", bg: "var(--blue-soft)", ink: "var(--blue)", meta: "PDF notes" },
  LIVE: { label: "LIVE", bg: "var(--live-soft)", ink: "var(--live)", meta: "Live class" },
  FLASHCARD: { label: "CARD", bg: "var(--orange-soft)", ink: "var(--orange-ink)", meta: "Flashcards" },
  TEST: { label: "QZ", bg: "var(--diff-easy-soft)", ink: "var(--diff-easy)", meta: "Quiz" },
};

function TypeChip({ kind, locked }: { kind: keyof typeof CHIP_META; locked?: boolean }) {
  const m = CHIP_META[kind];
  return (
    <div
      style={{
        width: 36,
        height: 24,
        borderRadius: 7,
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        fontWeight: 700,
        background: locked ? "var(--bg-sunk)" : m.bg,
        color: locked ? "var(--ink3)" : m.ink,
      }}
    >
      {m.label}
    </div>
  );
}

type RowState = "done" | "now" | "todo" | "locked";

/** Right-hand state glyph: green ✓ (done), orange ▶ ring (current), empty ring (to-do), lock. */
function StateGlyph({ state }: { state: RowState }) {
  if (state === "locked") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.8" style={{ flex: "none" }}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    );
  }
  if (state === "done") {
    return (
      <span style={{ width: 22, height: 22, borderRadius: 999, flex: "none", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (state === "now") {
    return (
      <span style={{ width: 22, height: 22, borderRadius: 999, flex: "none", border: "1.5px solid var(--orange)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--orange)">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    );
  }
  return <span style={{ width: 22, height: 22, borderRadius: 999, flex: "none", border: "1.5px solid var(--line)" }} />;
}

/** One S2 sidebar row: type chip · title + meta · optional NOW badge · state glyph. */
function SidebarRow({
  kind,
  title,
  meta,
  state,
  onClick,
  href,
}: {
  kind: keyof typeof CHIP_META;
  title: string;
  meta: string;
  state: RowState;
  onClick?: () => void;
  href?: string;
}) {
  const active = state === "now";
  const locked = state === "locked";
  const inner = (
    <>
      <TypeChip kind={kind} locked={locked} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: active ? 700 : 500,
            color: locked ? "var(--ink3)" : "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--ink3)", marginTop: 1 }}>{meta}</div>
      </div>
      {active && (
        <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5, background: "var(--orange)", color: "#fff", borderRadius: 4, padding: "3px 6px", flex: "none" }}>
          NOW
        </span>
      )}
      <StateGlyph state={state} />
    </>
  );
  const style: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "11px 20px",
    background: active ? "var(--orange-soft)" : "transparent",
    // Only the left border is meaningful (the active marker); the button's other
    // three default borders are removed individually so this one survives.
    borderTop: "none",
    borderRight: "none",
    borderBottom: "none",
    borderLeft: active ? "3px solid var(--orange)" : "3px solid transparent",
    textAlign: "left",
    fontFamily: "inherit",
    opacity: locked ? 0.6 : 1,
    cursor: locked ? "default" : "pointer",
  };
  if (href && !locked) {
    return (
      <Link href={href} className="cd-lesson-row" style={{ ...style, textDecoration: "none", color: "inherit" }}>
        {inner}
      </Link>
    );
  }
  return (
    <button className="cd-lesson-row" onClick={locked ? undefined : onClick} disabled={locked} style={style}>
      {inner}
    </button>
  );
}

function lessonMeta(lesson: Lesson, chapterTitle: string) {
  if (lesson.type === "VIDEO") return `Video Lesson · ${chapterTitle}`;
  if (lesson.type === "PDF") return `PDF Notes · ${chapterTitle}`;
  if (lesson.type === "LIVE") return lesson.liveAt ? `Live Class · ${new Date(lesson.liveAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : `Live Class · ${chapterTitle}`;
  return chapterTitle;
}

interface VideoChapter {
  seconds: number;
  label: string;
}

/** Parses YouTube-style chapter lines ("0:00 Intro", "1:02:30 Topic") into sorted markers. */
function parseChapters(text?: string | null): VideoChapter[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => {
      const m = line.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})\s+(.+)$/);
      if (!m) return null;
      const h = m[1] ? parseInt(m[1], 10) : 0;
      return { seconds: h * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10), label: m[4].trim() };
    })
    .filter((c): c is VideoChapter => c !== null)
    .sort((a, b) => a.seconds - b.seconds);
}

function fmtTimestamp(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? m.toString().padStart(2, "0") : `${m}`;
  return `${h > 0 ? `${h}:` : ""}${mm}:${s.toString().padStart(2, "0")}`;
}

function VideoPlayer({ src, captionsVtt, chapters }: { src: string; captionsVtt?: string | null; chapters: VideoChapter[] }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const trackUrl = useMemo(() => (captionsVtt ? URL.createObjectURL(new Blob([captionsVtt], { type: "text/vtt" })) : null), [captionsVtt]);
  useEffect(() => () => { if (trackUrl) URL.revokeObjectURL(trackUrl); }, [trackUrl]);

  const activeChapter = chapters.reduce((acc, c, i) => (currentTime + 0.4 >= c.seconds ? i : acc), -1);

  function seek(seconds: number) {
    const v = videoRef.current;
    if (v) {
      v.currentTime = seconds;
      v.play().catch(() => {});
    }
  }

  return (
    <div className="fade-in-up" style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          position: "relative",
          borderRadius: "var(--rm)",
          overflow: "hidden",
          background: "linear-gradient(135deg,#1c1c1c,#2c2620)",
          boxShadow: "0 16px 40px rgba(0,0,0,.18)",
        }}
      >
        <video
          ref={videoRef}
          controls
          src={src}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          style={{ width: "100%", display: "block", aspectRatio: "16/9", background: "#000" }}
        >
          {trackUrl && <track kind="subtitles" src={trackUrl} srcLang="en" label="Captions" default />}
        </video>
        {!playing && (
          <button
            onClick={() => videoRef.current?.play()}
            aria-label="Play"
            className="pop-in"
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <span style={{ width: 62, height: 62, borderRadius: "50%", background: "rgba(255,255,255,.95)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(0,0,0,.3)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--ink)">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>

      {chapters.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ink2)", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Chapters
          </div>
          <div style={{ display: "grid", gap: 2 }}>
            {chapters.map((c, i) => {
              const active = i === activeChapter;
              return (
                <button
                  key={i}
                  onClick={() => seek(c.seconds)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 11px",
                    borderRadius: 9,
                    border: "none",
                    background: active ? "var(--orange-soft)" : "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--orange)" : "var(--ink3)", fontVariantNumeric: "tabular-nums", flex: "none", minWidth: 48 }}>
                    {fmtTimestamp(c.seconds)}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: active ? 700 : 500, color: active ? "var(--ink)" : "var(--ink2)" }}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LessonViewer({ lesson }: { lesson: Lesson }) {
  if (lesson.type === "VIDEO") {
    return lesson.contentUrl ? (
      <VideoPlayer src={lesson.contentUrl} captionsVtt={lesson.captionsVtt} chapters={parseChapters(lesson.videoChapters)} />
    ) : (
      <div
        className="fade-in-up"
        style={{
          padding: 24,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rm)",
          color: "var(--ink2)",
        }}
      >
        No video uploaded yet.
      </div>
    );
  }

  if (lesson.type === "PDF") {
    return lesson.contentUrl ? (
      <div className="fade-in-up" style={{ maxWidth: "100%" }}>
        <div
          style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "var(--rm)", overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,.06)" }}
        >
          {/* view=FitH fits the page to the frame width so portrait PDFs fill it instead of
              being letterboxed on the viewer's dark background; white bg covers any gaps.
              Inline PDF-in-iframe is unreliable on iOS Safari, so the "Open PDF" link below
              is the dependable fallback (native full-screen viewer with pan/zoom). */}
          <iframe
            src={`${lesson.contentUrl}#toolbar=0&navpanes=0&view=FitH`}
            style={{ width: "100%", height: "85vh", border: "none", display: "block", background: "#fff" }}
          />
        </div>
        <a
          href={lesson.contentUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            padding: "9px 16px",
            background: "var(--orange)",
            color: "#fff",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 2px 8px rgba(242,106,27,.3)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
          </svg>
          Open PDF
        </a>
      </div>
    ) : (
      <div className="fade-in-up" style={{ padding: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", color: "var(--ink2)" }}>
        No PDF uploaded yet.
      </div>
    );
  }

  if (lesson.type === "LIVE") {
    return (
      <div
        className="pop-in"
        style={{
          maxWidth: 620,
          margin: "40px auto",
          textAlign: "center",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rl)",
          padding: "48px 40px",
        }}
      >
        <div
          className="live-pulse"
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "var(--orange-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="1.8">
            <path d="m23 7-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" />
          </svg>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--orange)", textTransform: "uppercase", marginBottom: 8 }}>
          Live Class
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4 }}>{lesson.title}</div>
        <p style={{ color: "var(--ink3)", fontSize: 14, margin: "10px 0 24px" }}>
          {lesson.liveAt ? new Date(lesson.liveAt).toLocaleString() : "Schedule not set yet."}
        </p>
        <div>
          <button
            style={{
              padding: "14px 36px",
              background: "var(--ink)",
              color: "#fff",
              border: "none",
              borderRadius: 13,
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Join Live Class
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function StudentCoursePlayerPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const [course, setCourse] = useState<CourseTree | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "flashcards" | "summary" | "cheatsheet" | "notes" | "doubt">("overview");
  const [flashcardCount, setFlashcardCount] = useState<number | null>(null);
  const [completingChapterId, setCompletingChapterId] = useState<string | null>(null);
  const [lessonOpenedByUser, setLessonOpenedByUser] = useState(false);

  function openLesson(id: string) {
    setSelectedLessonId(id);
    setLessonOpenedByUser(true);
  }

  function closeLesson() {
    setSelectedLessonId(null);
    setLessonOpenedByUser(false);
  }

  useEffect(() => {
    coursesApi
      .get(courseId)
      .then((c) => {
        setCourse(c);
        const firstUnlocked = c.chapters.find((ch) => ch.unlocked !== false) ?? c.chapters[0];
        setSelectedLessonId(firstUnlocked?.lessons[0]?.id ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setNotEnrolled(true);
        } else {
          setError(err instanceof ApiError ? err.message : "Failed to load course");
        }
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    setActiveTab("overview");
    setFlashcardCount(null);
  }, [selectedLessonId]);

  useEffect(() => {
    const allLessons = course?.chapters.flatMap((c) => c.lessons) ?? [];
    const lesson = allLessons.find((l) => l.id === selectedLessonId);
    if (lesson?.flashcardsEnabled) {
      flashcardsApi.list(lesson.id).then((cards) => setFlashcardCount(cards.length)).catch(() => setFlashcardCount(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLessonId, course]);

  useEffect(() => {
    // Recorded for every drip type now (not just SEQUENTIAL, which needs it for lesson-chain
    // unlocking) so Planner's Weekly progress tab has real per-chapter view data for any course.
    if (selectedLessonId) {
      coursesApi
        .recordLessonView(selectedLessonId)
        .then(() => {
          // Reflect the view locally so the progress bar moves immediately (and matches the
          // server on the next load) without refetching the whole tree.
          setCourse((prev) =>
            prev
              ? {
                  ...prev,
                  chapters: prev.chapters.map((ch) => ({
                    ...ch,
                    lessons: ch.lessons.map((l) => (l.id === selectedLessonId ? { ...l, viewed: true } : l)),
                  })),
                }
              : prev,
          );
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLessonId]);

  async function onMarkChapterComplete(chapterId: string) {
    setCompletingChapterId(chapterId);
    try {
      await coursesApi.markChapterComplete(chapterId);
      const c = await coursesApi.get(courseId);
      setCourse(c);
    } finally {
      setCompletingChapterId(null);
    }
  }

  async function onEnroll() {
    setEnrolling(true);
    try {
      await coursesApi.enroll(courseId);
      setNotEnrolled(false);
      setLoading(true);
      const c = await coursesApi.get(courseId);
      setCourse(c);
      setSelectedLessonId(c.chapters[0]?.lessons[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to enroll");
    } finally {
      setEnrolling(false);
      setLoading(false);
    }
  }

  if (loading) return <main style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></main>;

  if (notEnrolled) {
    return (
      <main className="fade-in-up" style={{ padding: 40, maxWidth: 480 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>You&apos;re not enrolled in this course yet</h1>
        <p style={{ color: "var(--ink2)", marginTop: 8, marginBottom: 20 }}>
          Enroll to unlock the lessons.
        </p>
        <button
          onClick={onEnroll}
          disabled={enrolling}
          style={{
            padding: "12px 22px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: enrolling ? "default" : "pointer",
            opacity: enrolling ? 0.7 : 1,
          }}
        >
          {enrolling ? "Enrolling…" : "Enroll now"}
        </button>
        <p style={{ marginTop: 18 }}>
          <Link href="/student/courses" style={{ color: "var(--orange)", fontWeight: 700, fontSize: 14 }}>
            ← Back to courses
          </Link>
        </p>
      </main>
    );
  }

  if (error || !course) return <main style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Course not found"}</p></main>;

  const allLessons = course.chapters.flatMap((c) => c.lessons);
  const selectedLesson = allLessons.find((l) => l.id === selectedLessonId) ?? null;
  const selectedChapter = course.chapters.find((c) => c.lessons.some((l) => l.id === selectedLessonId)) ?? null;
  // Progress reflects lessons actually viewed (persisted server-side via LessonView),
  // not which lesson happens to be selected — otherwise it resets on every remount.
  const viewedCount = allLessons.filter((l) => l.viewed).length;
  const progressPct = allLessons.length > 0 ? Math.round((viewedCount / allLessons.length) * 100) : 0;

  // "Continue →" targets the first unlocked lesson the student hasn't viewed; once
  // everything is viewed there's nothing to continue to, so the button is hidden.
  const nextLesson = allLessons.find((l) => !l.viewed && l.unlocked !== false) ?? null;

  const tabs: { key: typeof activeTab; label: string }[] = selectedLesson
    ? [
        { key: "overview" as const, label: "Overview" },
        ...(selectedLesson.flashcardsEnabled ? [{ key: "flashcards" as const, label: `Flashcards${flashcardCount !== null ? ` (${flashcardCount})` : ""}` }] : []),
        ...(selectedLesson.summaryDeckEnabled ? [{ key: "summary" as const, label: "Deck" }] : []),
        ...(selectedLesson.cheatSheetEnabled ? [{ key: "cheatsheet" as const, label: "Cheat Sheet" }] : []),
        ...(selectedLesson.aiNotesEnabled && selectedLesson.type === "VIDEO" ? [{ key: "notes" as const, label: "Notes" }] : []),
        ...(selectedLesson.askMeEnabled ? [{ key: "doubt" as const, label: "Doubt" }] : []),
      ]
    : [];

  return (
    <div style={{ display: "flex", margin: 0, height: "100%", background: "var(--bg)" }}>
      {/* Course-content sidebar. S2 places it on the RIGHT of the player (flex order: 2,
          border-left), with just the lesson list — no dark course card, no rating box. */}
      <div
        className={`course-pane-list${lessonOpenedByUser ? " has-selection" : ""}`}
        style={{ width: 340, flex: "none", background: "var(--card)", borderLeft: "1px solid var(--line)", overflowY: "auto", order: 2 }}
      >
        {/* ③ "Course content" + viewed/total counter (design S2 sidebar). */}
        <div style={{ padding: "18px 18px 8px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800 }}>Course content</div>
          <span style={{ fontSize: 11, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--ink3)" }}>
            {viewedCount}/{allLessons.length}
          </span>
        </div>

        {/* S2 sidebar: flat mono section-headers + type-chip lesson rows, no accordion. */}
        {course.chapters.map((chapter: Chapter, chapterIdx: number) => {
          const chapterLocked = chapter.unlocked === false;
          const lessonCount = chapter.lessons.length;
          const viewedInChapter = chapter.lessons.filter((l) => l.viewed).length;
          const status = chapterLocked
            ? "locked"
            : chapter.finished
            ? "done"
            : `${viewedInChapter}/${lessonCount} done`;
          const items = [
            ...chapter.lessons.map((l) => ({ kind: "lesson" as const, order: l.order, lesson: l })),
            ...chapter.tests.map((t) => ({ kind: "test" as const, order: t.order, test: t })),
          ].sort((a, b) => a.order - b.order);
          const showMarkComplete =
            !chapterLocked && course.dripType === "SEQUENTIAL" && course.completionRule === "MANUAL";
          return (
            <div key={chapter.id} className="fade-in-up">
              <div className="cd-section-head">
                CH {chapterIdx + 1} · {chapter.title.toUpperCase()} · {status}
              </div>

              {items.map((it) => {
                if (it.kind === "lesson") {
                  const l = it.lesson;
                  const locked = chapterLocked || l.unlocked === false;
                  const state: RowState = locked
                    ? "locked"
                    : l.id === selectedLessonId
                    ? "now"
                    : l.viewed
                    ? "done"
                    : "todo";
                  return (
                    <SidebarRow
                      key={l.id}
                      kind={l.type}
                      title={l.title}
                      meta={locked ? "Locked" : CHIP_META[l.type]?.meta ?? "Lesson"}
                      state={state}
                      onClick={() => openLesson(l.id)}
                    />
                  );
                }
                const t = it.test;
                const locked = chapterLocked || t.unlocked === false;
                return (
                  <SidebarRow
                    key={t.id}
                    kind="TEST"
                    title={t.title}
                    meta={locked ? "Locked" : "Quiz"}
                    state={locked ? "locked" : "todo"}
                    href={`/student/mock-test/${t.id}`}
                  />
                );
              })}

              {showMarkComplete && (
                <div style={{ padding: "8px 20px 12px" }}>
                  {chapter.finished ? (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--green)" }}>✓ Marked complete</span>
                  ) : (
                    <button
                      onClick={() => onMarkChapterComplete(chapter.id)}
                      disabled={completingChapterId === chapter.id}
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "var(--orange-deep)",
                        background: "var(--orange-soft)",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 12px",
                        cursor: completingChapterId === chapter.id ? "default" : "pointer",
                        fontFamily: "inherit",
                        opacity: completingChapterId === chapter.id ? 0.7 : 1,
                      }}
                    >
                      {completingChapterId === chapter.id ? "Marking…" : "Mark chapter complete"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom "Continue →" button (S2 sidebar). */}
        {nextLesson && (
          <div style={{ padding: "18px 20px 8px" }}>
            <button
              onClick={() => openLesson(nextLesson.id)}
              style={{
                width: "100%",
                height: 42,
                background: "var(--orange)",
                color: "#fff",
                border: "none",
                borderRadius: 11,
                fontSize: 13.5,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(242,106,27,.3)",
              }}
            >
              Continue →
            </button>
          </div>
        )}
      </div>

      {/* Lesson/player area — the main left column in S2 (flex order: 1). */}
      <div
        className={`course-pane-detail${lessonOpenedByUser ? " has-selection" : ""}`}
        style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative", order: 1 }}
      >
        {selectedLesson ? (
          <>
            <div style={{ flex: "none", background: "var(--card)", borderBottom: "1px solid var(--line)", padding: "16px 26px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <button
                  className="mobile-back-btn"
                  onClick={closeLesson}
                  aria-label="Back to chapters"
                  style={{ width: 30, height: 30, flex: "none", border: "1px solid var(--line)", borderRadius: 9, background: "var(--bg)", cursor: "pointer", alignItems: "center", justifyContent: "center" }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.2">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <div style={{ fontSize: 12, color: "var(--ink3)" }}>
                  {course.title} <span style={{ color: "var(--line)" }}>/</span> {selectedChapter?.title}{" "}
                  <span style={{ color: "var(--line)" }}>/</span>{" "}
                  <span style={{ color: "var(--ink2)", fontWeight: 600 }}>{selectedLesson.title}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px", minWidth: 160 }}>
                  <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.4 }}>{selectedLesson.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 3 }}>
                    {lessonMeta(selectedLesson, selectedChapter?.title ?? "")}
                  </div>
                </div>

                {/* ② Resources — downloads the lesson's own file (the presigned
                    contentUrl). Hidden for LIVE/FLASHCARD lessons, which have no file. */}
                {selectedLesson.contentUrl && (selectedLesson.type === "VIDEO" || selectedLesson.type === "PDF") && (
                  <a
                    href={selectedLesson.contentUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cd-resources"
                  >
                    ⤓ Resources
                  </a>
                )}

                {/* ① Course progress + Continue → (design S2 header). */}
                {allLessons.length > 0 && (
                  <div className="cd-progress" style={{ display: "flex", alignItems: "center", gap: 9, flex: "none" }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink2)" }}>Course progress</span>
                    <div style={{ width: 120, height: 6, background: "var(--line2)", borderRadius: 999, overflow: "hidden", flex: "none" }}>
                      <div style={{ width: `${progressPct}%`, height: "100%", background: "var(--progress)", transition: "width .4s ease" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--green)" }}>{progressPct}%</span>
                  </div>
                )}
                {nextLesson && (
                  <button
                    onClick={() => openLesson(nextLesson.id)}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      background: "var(--orange)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      height: 36,
                      padding: "0 18px",
                      fontFamily: "inherit",
                      cursor: "pointer",
                      flex: "none",
                    }}
                  >
                    Continue →
                  </button>
                )}
              </div>
            </div>

            <div
              className="lesson-tabbar"
              style={{ flex: "none", display: "flex", gap: 2, borderBottom: "1px solid var(--line)", padding: "0 26px", background: "var(--card)", overflowX: "auto" }}
            >
              {tabs.map((tb) => (
                <div
                  key={tb.key}
                  onClick={() => setActiveTab(tb.key)}
                  style={{
                    padding: "12px 16px",
                    fontSize: 13,
                    fontWeight: activeTab === tb.key ? 700 : 500,
                    color: activeTab === tb.key ? "var(--orange-deep)" : "var(--ink2)",
                    borderBottom: activeTab === tb.key ? "2px solid var(--orange)" : "2px solid transparent",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    flex: "none",
                  }}
                >
                  {tb.label}
                </div>
              ))}
            </div>

            <div className="mobile-page-pad" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: 26, display: "flex" }}>
              <div style={{ flex: 1, minWidth: 0, maxWidth: "100%" }}>
                {activeTab === "flashcards" ? (
                  <FlashcardReview key={selectedLesson.id} lessonId={selectedLesson.id} lessonTitle={selectedLesson.title} />
                ) : activeTab === "summary" ? (
                  <SummaryDeckReview key={selectedLesson.id} lessonId={selectedLesson.id} lessonTitle={selectedLesson.title} />
                ) : activeTab === "cheatsheet" ? (
                  <CheatSheetReview key={selectedLesson.id} lessonId={selectedLesson.id} lessonTitle={selectedLesson.title} />
                ) : activeTab === "notes" ? (
                  <div style={{ maxWidth: 720, margin: "0 auto" }}>
                    <LessonNotes lessonId={selectedLesson.id} />
                  </div>
                ) : activeTab === "doubt" ? (
                  <div style={{ maxWidth: 720, margin: "0 auto", height: 560 }}>
                    <AskMeChat key={selectedLesson.id} lessonId={selectedLesson.id} />
                  </div>
                ) : (
                  // S2 has no beside-video lesson list — the right sidebar is the only
                  // lesson list, so the player spans the full content column.
                  <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gap: 18 }}>
                    <LessonViewer lesson={selectedLesson} />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: 40, color: "var(--ink2)" }}>This course has no lessons yet.</div>
        )}
      </div>
    </div>
  );
}
