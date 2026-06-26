"use client";

import { useEffect, useRef, useState } from "react";
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

function VideoPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div
      className="fade-in-up"
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
        style={{ width: "100%", display: "block", aspectRatio: "16/9", background: "#000" }}
      />
      {!playing && (
        <button
          onClick={() => videoRef.current?.play()}
          aria-label="Play"
          className="pop-in"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <span
            style={{
              width: 62,
              height: 62,
              borderRadius: "50%",
              background: "rgba(255,255,255,.95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(0,0,0,.3)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--ink)">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}

function LessonViewer({ lesson }: { lesson: Lesson }) {
  if (lesson.type === "VIDEO") {
    return lesson.contentUrl ? (
      <VideoPlayer src={lesson.contentUrl} />
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
      <div
        className="fade-in-up"
        style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,.06)" }}
      >
        <iframe src={lesson.contentUrl} style={{ width: "100%", height: "70vh", border: "none", display: "block" }} />
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
  const [viewMode, setViewMode] = useState<"lesson" | "flashcards" | "summary" | "cheatsheet">("lesson");
  const [showChat, setShowChat] = useState(false);
  const [flashcardCount, setFlashcardCount] = useState<number | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [completingChapterId, setCompletingChapterId] = useState<string | null>(null);

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
    setViewMode("lesson");
    setShowChat(false);
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
    if (course?.dripType === "SEQUENTIAL" && selectedLessonId) {
      coursesApi.recordLessonView(selectedLessonId).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLessonId, course?.dripType]);

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
  const lessonIndex = allLessons.findIndex((l) => l.id === selectedLessonId);
  const progressPct = allLessons.length > 0 ? Math.round(((lessonIndex + 1) / allLessons.length) * 100) : 0;

  return (
    <div style={{ display: "flex", margin: 0, height: "100%", background: "var(--bg)" }}>
      {/* chapter sidebar */}
      <div
        className={`course-pane-list${selectedLesson ? " has-selection" : ""}`}
        style={{ width: 286, flex: "none", background: "var(--card)", borderRight: "1px solid var(--line)", overflowY: "auto" }}
      >
        <div
          className="fade-in-up"
          style={{
            margin: 14,
            padding: "20px 18px",
            borderRadius: "var(--rm)",
            background: "linear-gradient(135deg,#1c1c1c,#2c2620)",
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: "#f7b274", textTransform: "uppercase" }}>
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

        <div style={{ padding: "4px 18px 8px", fontSize: 13.5, fontWeight: 800 }}>Chapters</div>

        {course.chapters.map((chapter: Chapter, chapterIdx: number) => {
          const open = expandedChapterId === chapter.id;
          const locked = chapter.unlocked === false;
          const isActiveChapter = chapter.id === selectedChapter?.id;
          const lessonItems = chapter.lessons.filter((l) => l.id);
          const activeLessonPos = lessonItems.findIndex((l) => l.id === selectedLessonId);
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
                      : isActiveChapter && activeLessonPos >= 0
                      ? `In progress · ${activeLessonPos + 1}/${lessonItems.length}`
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
                              onSelect={setSelectedLessonId}
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
        className={`course-pane-detail${selectedLesson ? " has-selection" : ""}`}
        style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}
      >
        {selectedLesson ? (
          <>
            <div style={{ flex: "none", background: "var(--card)", borderBottom: "1px solid var(--line)", padding: "16px 26px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <button
                  className="mobile-back-btn"
                  onClick={() => setSelectedLessonId(null)}
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
                <div className="lesson-action-row" style={{ display: "flex", gap: 10, flex: "none", flexWrap: "wrap", marginLeft: "auto" }}>
                  {selectedLesson.flashcardsEnabled && (
                    <button
                      onClick={() => setViewMode(viewMode === "flashcards" ? "lesson" : "flashcards")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "10px 14px",
                        background: viewMode === "flashcards" ? "var(--orange)" : "var(--orange-soft)",
                        color: viewMode === "flashcards" ? "#fff" : "var(--orange)",
                        border: "none",
                        borderRadius: 11,
                        fontSize: 12.5,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="5" width="14" height="16" rx="2" />
                        <path d="M7 5V3h14v16h-2" />
                      </svg>
                      Flashcards{flashcardCount !== null ? ` (${flashcardCount})` : ""}
                    </button>
                  )}
                  {selectedLesson.summaryDeckEnabled && (
                    <button
                      onClick={() => setViewMode(viewMode === "summary" ? "lesson" : "summary")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "10px 14px",
                        background: viewMode === "summary" ? "var(--purple)" : "var(--purple-soft)",
                        color: viewMode === "summary" ? "#fff" : "var(--purple)",
                        border: "none",
                        borderRadius: 11,
                        fontSize: 12.5,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      Summary Deck
                    </button>
                  )}
                  {selectedLesson.cheatSheetEnabled && (
                    <button
                      onClick={() => setViewMode(viewMode === "cheatsheet" ? "lesson" : "cheatsheet")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "10px 14px",
                        background: viewMode === "cheatsheet" ? "var(--orange)" : "var(--orange-soft)",
                        color: viewMode === "cheatsheet" ? "#fff" : "var(--orange)",
                        border: "none",
                        borderRadius: 11,
                        fontSize: 12.5,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                      Cheat Sheet
                    </button>
                  )}
                  {selectedLesson.askMeEnabled && (
                    <button
                      onClick={() => setShowChat((s) => !s)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "10px 15px",
                        background: "var(--orange)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 11,
                        fontSize: 12.5,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(242,106,27,.32)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Ask a doubt
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mobile-page-pad" style={{ flex: 1, overflowY: "auto", padding: 26, display: "flex" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {viewMode === "flashcards" ? (
                  <FlashcardReview key={selectedLesson.id} lessonId={selectedLesson.id} lessonTitle={selectedLesson.title} />
                ) : viewMode === "summary" ? (
                  <SummaryDeckReview key={selectedLesson.id} lessonId={selectedLesson.id} lessonTitle={selectedLesson.title} />
                ) : viewMode === "cheatsheet" ? (
                  <CheatSheetReview key={selectedLesson.id} lessonId={selectedLesson.id} lessonTitle={selectedLesson.title} />
                ) : selectedLesson.type === "VIDEO" && (selectedChapter?.lessons.length ?? 0) > 1 ? (
                  <div className="lesson-video-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 280px", gap: 18 }}>
                    <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
                      <LessonViewer lesson={selectedLesson} />
                      {selectedLesson.aiNotesEnabled && <LessonNotes lessonId={selectedLesson.id} />}
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
                              onClick={() => !lLocked && setSelectedLessonId(l.id)}
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
                    {selectedLesson.aiNotesEnabled && selectedLesson.type === "VIDEO" && <LessonNotes lessonId={selectedLesson.id} />}
                  </div>
                )}
              </div>

              {showChat && selectedLesson.askMeEnabled && (
                <div className="askme-panel" style={{ width: 360, flex: "none", marginLeft: 18, height: "calc(100% - 24px)", position: "sticky", top: 0 }}>
                  <AskMeChat lessonId={selectedLesson.id} onClose={() => setShowChat(false)} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: 40, color: "var(--ink2)" }}>This course has no lessons yet.</div>
        )}
      </div>
    </div>
  );
}
