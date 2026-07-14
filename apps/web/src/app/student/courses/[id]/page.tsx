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

function LessonIcon({ type, color }: { type: Lesson["type"]; color: string }) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8 } as const;
  if (type === "PDF") {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    );
  }
  if (type === "LIVE") {
    return (
      <svg {...common}>
        <path d="m23 7-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    );
  }
  // VIDEO / FLASHCARD fallback — circular play icon, matches reference's typeIcon default
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M10 8l6 4-6 4V8z" />
    </svg>
  );
}

type ChapterTest = Chapter["tests"][number];

function LessonNavItem({ lesson, active, onSelect }: { lesson: Lesson; active: boolean; onSelect: (id: string) => void }) {
  const lessonLocked = lesson.unlocked === false;
  const color = lessonLocked ? "var(--ink3)" : active ? "var(--orange)" : "var(--ink3)";
  return (
    <button
      onClick={() => !lessonLocked && onSelect(lesson.id)}
      disabled={lessonLocked}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "10px 18px 10px 30px",
        border: "none",
        background: active ? "var(--orange-soft)" : "transparent",
        position: "relative",
        cursor: lessonLocked ? "default" : "pointer",
        fontFamily: "inherit",
        textAlign: "left",
        borderLeft: active ? "3px solid var(--orange)" : "3px solid transparent",
        opacity: lessonLocked ? 0.55 : 1,
      }}
    >
      <span style={{ color, display: "flex" }}>
        {lessonLocked ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        ) : (
          <LessonIcon type={lesson.type} color={color} />
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: active ? 700 : 500,
            color: active ? "var(--ink)" : "var(--ink2)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {lesson.title}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--ink3)", marginTop: 1 }}>
          {lessonLocked ? "Complete the previous lesson to unlock" : lesson.type}
        </div>
      </div>
      {active ? (
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, color: "var(--orange)", flex: "none" }}>NOW</span>
      ) : (
        <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", border: "1.5px solid var(--line)" }} />
      )}
    </button>
  );
}

function TestNavItem({ test }: { test: ChapterTest }) {
  const testLocked = test.unlocked === false;
  return (
    <Link
      href={testLocked ? "#" : `/student/mock-test/${test.id}`}
      onClick={(e) => testLocked && e.preventDefault()}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "10px 18px 10px 30px",
        cursor: testLocked ? "default" : "pointer",
        textAlign: "left",
        opacity: testLocked ? 0.55 : 1,
      }}
    >
      <span style={{ color: "var(--purple)", display: "flex" }}>
        {testLocked ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink2)" }}>{test.title}</div>
        <div style={{ fontSize: 10.5, color: "var(--ink3)", marginTop: 1 }}>
          {testLocked ? "Complete the lessons above to unlock" : "Test"}
        </div>
      </div>
    </Link>
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

/** Compact course-rating card for the enrolled sidebar: shows the average and lets the
 *  student set/update their own star rating (+ optional comment). */
function CourseRatingCard({ courseId, avgRating, reviewCount }: { courseId: string; avgRating?: number | null; reviewCount?: number }) {
  const [mine, setMine] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedAvg, setSavedAvg] = useState<number | null | undefined>(avgRating);
  const [savedCount, setSavedCount] = useState<number | undefined>(reviewCount);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    coursesApi
      .myReview(courseId)
      .then((r) => {
        if (r) {
          setMine(r.rating);
          setComment(r.comment ?? "");
        }
      })
      .catch(() => {});
  }, [courseId]);

  async function submit(rating: number) {
    setSaving(true);
    setErr(null);
    try {
      await coursesApi.submitReview(courseId, { rating, comment: comment.trim() || undefined });
      setMine(rating);
      const summary = await coursesApi.listReviews(courseId).catch(() => null);
      if (summary) {
        setSavedAvg(summary.avgRating);
        setSavedCount(summary.reviewCount);
      }
      setOpen(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to submit rating");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ margin: "0 14px 12px", padding: "14px 16px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--amber)", fontSize: 15, letterSpacing: 1 }}>
            {"★".repeat(Math.round(savedAvg ?? 0))}
            <span style={{ color: "var(--line)" }}>{"★".repeat(5 - Math.round(savedAvg ?? 0))}</span>
          </span>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{savedAvg != null ? savedAvg.toFixed(1) : "—"}</span>
          <span style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600 }}>({savedCount ?? 0})</span>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ fontSize: 12, fontWeight: 700, color: "var(--orange)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
        >
          {mine ? "Edit rating" : "Rate course"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }} onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onMouseEnter={() => setHover(n)}
                onClick={() => submit(n)}
                disabled={saving}
                aria-label={`${n} star`}
                style={{ background: "none", border: "none", cursor: saving ? "default" : "pointer", padding: 0, fontSize: 24, lineHeight: 1, color: (hover || mine || 0) >= n ? "var(--amber)" : "var(--line)" }}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional — a quick note about the course"
            rows={2}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--line)", borderRadius: "var(--rs)", fontSize: 12.5, fontFamily: "inherit", outline: "none", resize: "vertical" }}
          />
          {err && <div style={{ color: "var(--red)", fontSize: 11.5, marginTop: 6 }}>{err}</div>}
          <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 6 }}>{saving ? "Saving…" : "Tap a star to submit."}</div>
        </div>
      )}
    </div>
  );
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
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
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
        setExpandedChapterId(firstUnlocked?.id ?? null);
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
      {/* chapter sidebar */}
      <div
        className={`course-pane-list${lessonOpenedByUser ? " has-selection" : ""}`}
        style={{ width: 286, flex: "none", background: "var(--card)", borderRight: "1px solid var(--line)", overflowY: "auto" }}
      >
        <div
          className="fade-in-up"
          style={{
            margin: 14,
            padding: "20px 18px",
            borderRadius: "var(--rm)",
            background: "linear-gradient(135deg,#1c1915,#2a2620)",
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: "var(--orange-bright)", textTransform: "uppercase" }}>
            Enrolled Course
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, marginTop: 6 }}>{course.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)", marginTop: 4 }}>
            {course.chapters.length} chapters · {allLessons.length} lessons
          </div>
          {allLessons.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,.18)", borderRadius: 3 }}>
                <div style={{ width: `${progressPct}%`, height: "100%", background: "var(--orange)", borderRadius: 3, transition: "width .4s ease" }} />
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--orange)", flex: "none" }}>{progressPct}% complete</span>
            </div>
          )}
        </div>

        <CourseRatingCard courseId={course.id} avgRating={course.avgRating} reviewCount={course.reviewCount} />

        <div style={{ padding: "4px 18px 8px", fontSize: 13.5, fontWeight: 800 }}>Chapters</div>

        {course.chapters.map((chapter: Chapter, chapterIdx: number) => {
          const open = expandedChapterId === chapter.id;
          const locked = chapter.unlocked === false;
          const isActiveChapter = chapter.id === selectedChapter?.id;
          const lessonItems = chapter.lessons.filter((l) => l.id);
          const activeLessonPos = lessonItems.findIndex((l) => l.id === selectedLessonId);
          const viewedInChapter = lessonItems.filter((l) => l.viewed).length;
          return (
            <div
              key={chapter.id}
              className="fade-in-up"
              style={{
                margin: "0 14px 10px",
                borderRadius: "var(--rm)",
                border: isActiveChapter ? "1.5px solid var(--orange)" : "1px solid var(--line)",
                background: "var(--card)",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setExpandedChapterId(open ? null : chapter.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  opacity: locked ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: chapter.finished ? "var(--green-soft)" : isActiveChapter ? "var(--orange)" : "var(--bg)",
                    color: chapter.finished ? "var(--green)" : isActiveChapter ? "#fff" : "var(--ink2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {locked ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  ) : chapter.finished ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    chapterIdx + 1
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{chapter.title}</div>
                  <div style={{ fontSize: 11.5, color: locked ? "var(--ink3)" : isActiveChapter ? "var(--orange)" : "var(--ink3)", marginTop: 1, fontWeight: isActiveChapter ? 700 : 400 }}>
                    {locked
                      ? chapter.unlocksAt
                        ? `Unlocks ${new Date(chapter.unlocksAt).toLocaleDateString()}`
                        : "Locked"
                      : chapter.finished
                      ? "Completed"
                      : viewedInChapter > 0
                      ? `In progress · ${viewedInChapter}/${lessonItems.length}`
                      : `${chapter.lessons.length} lessons`}
                  </div>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink3)"
                  strokeWidth="2"
                  style={{ transition: "transform .25s", transform: open ? "rotate(90deg)" : "none", flex: "none" }}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>

              {open && (
                <div className="fade-in-up" style={{ paddingBottom: 6, borderTop: "1px solid var(--line2)" }}>
                  {locked ? (
                    <div style={{ padding: "8px 18px 14px 30px", fontSize: 12, color: "var(--ink3)" }}>
                      This chapter is locked
                      {chapter.unlocksAt ? ` until ${new Date(chapter.unlocksAt).toLocaleString()}` : ""}.
                    </div>
                  ) : (
                    <>
                      {[
                        ...chapter.lessons.map((l) => ({ kind: "lesson" as const, order: l.order, data: l })),
                        ...chapter.tests.map((t) => ({ kind: "test" as const, order: t.order, data: t })),
                      ]
                        .sort((a, b) => a.order - b.order)
                        .map((item) =>
                          item.kind === "lesson" ? (
                            <LessonNavItem
                              key={item.data.id}
                              lesson={item.data}
                              active={item.data.id === selectedLessonId}
                              onSelect={openLesson}
                            />
                          ) : (
                            <TestNavItem key={item.data.id} test={item.data} />
                          ),
                        )}
                    </>
                  )}
                  {!locked && course.dripType === "SEQUENTIAL" && course.completionRule === "MANUAL" && (
                    <div style={{ padding: "8px 18px 12px 30px" }}>
                      {chapter.finished ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>✓ Marked complete</span>
                      ) : (
                        <button
                          onClick={() => onMarkChapterComplete(chapter.id)}
                          disabled={completingChapterId === chapter.id}
                          style={{
                            padding: "7px 14px",
                            background: "var(--orange)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 9,
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: "inherit",
                            cursor: completingChapterId === chapter.id ? "default" : "pointer",
                            opacity: completingChapterId === chapter.id ? 0.7 : 1,
                          }}
                        >
                          {completingChapterId === chapter.id ? "Marking…" : "Mark chapter complete"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* lesson area */}
      <div
        className={`course-pane-detail${lessonOpenedByUser ? " has-selection" : ""}`}
        style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}
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
                ) : selectedLesson.type === "VIDEO" && (selectedChapter?.lessons.length ?? 0) > 1 ? (
                  <div className="lesson-video-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 280px", gap: 18 }}>
                    <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
                      <LessonViewer lesson={selectedLesson} />
                    </div>
                    <div
                      className="fade-in-up"
                      style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 18, alignSelf: "start" }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>{selectedChapter?.title}</div>
                      <div style={{ display: "grid", gap: 4 }}>
                        {selectedChapter?.lessons.map((l) => {
                          const lLocked = l.unlocked === false;
                          const active = l.id === selectedLessonId;
                          return (
                            <button
                              key={l.id}
                              onClick={() => !lLocked && openLesson(l.id)}
                              disabled={lLocked}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "9px 11px",
                                border: "none",
                                background: active ? "var(--bg)" : "transparent",
                                borderRadius: 9,
                                cursor: lLocked ? "default" : "pointer",
                                fontFamily: "inherit",
                                textAlign: "left",
                                width: "100%",
                                opacity: lLocked ? 0.55 : 1,
                              }}
                            >
                              <span style={{ color: active ? "var(--orange)" : "var(--ink3)", display: "flex" }}>
                                {lLocked ? (
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <rect x="5" y="11" width="14" height="9" rx="2" />
                                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                                  </svg>
                                ) : (
                                  <LessonIcon type={l.type} color={active ? "var(--orange)" : "var(--ink3)"} />
                                )}
                              </span>
                              <span style={{ fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? "var(--ink)" : "var(--ink2)" }}>{l.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
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
