"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { coursesApi, flashcardsApi, ApiError, type Chapter, type CourseTree, type Lesson } from "@/lib/api";
import FlashcardReview from "@/components/FlashcardReview";
import LessonNotes from "@/components/LessonNotes";
import AskMeChat from "@/components/AskMeChat";

function LessonIcon({ type, active }: { type: Lesson["type"]; active: boolean }) {
  const color = active ? "var(--orange)" : "var(--ink3)";
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2 } as const;
  if (type === "VIDEO") {
    return (
      <svg {...common}>
        <path d="m10 8 6 4-6 4V8Z" />
        <rect x="2" y="3" width="20" height="18" rx="3" />
      </svg>
    );
  }
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
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" fill={color} stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="5" width="14" height="16" rx="2" />
      <path d="M7 5V3h14v16h-2" />
    </svg>
  );
}

function LessonViewer({ lesson }: { lesson: Lesson }) {
  if (lesson.type === "VIDEO") {
    return lesson.contentUrl ? (
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
        <video controls src={lesson.contentUrl} style={{ width: "100%", display: "block", aspectRatio: "16/9", background: "#000" }} />
      </div>
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
  const [viewMode, setViewMode] = useState<"lesson" | "flashcards">("lesson");
  const [showChat, setShowChat] = useState(false);
  const [flashcardCount, setFlashcardCount] = useState<number | null>(null);

  useEffect(() => {
    coursesApi
      .get(courseId)
      .then((c) => {
        setCourse(c);
        setSelectedLessonId(c.chapters[0]?.lessons[0]?.id ?? null);
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
    <div style={{ display: "flex", margin: 0, minHeight: "100vh", background: "var(--bg)" }}>
      {/* chapter sidebar */}
      <div style={{ width: 286, flex: "none", background: "var(--card)", borderRight: "1px solid var(--line)", overflowY: "auto" }}>
        <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--orange)", textTransform: "uppercase" }}>
            Course
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, marginTop: 3 }}>{course.title}</div>
          {allLessons.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1, height: 6, background: "var(--bg)", borderRadius: 3 }}>
                <div style={{ width: `${progressPct}%`, height: "100%", background: "var(--orange)", borderRadius: 3, transition: "width .4s ease" }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink2)" }}>{progressPct}%</span>
            </div>
          )}
        </div>

        {course.chapters.map((chapter: Chapter) => (
          <div key={chapter.id} style={{ padding: "14px 18px 6px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", marginBottom: 6 }}>
              {chapter.title}
            </div>
            <div style={{ display: "grid", gap: 2, marginBottom: 8 }}>
              {chapter.lessons.map((lesson) => {
                const active = lesson.id === selectedLessonId;
                return (
                  <button
                    key={lesson.id}
                    onClick={() => setSelectedLessonId(lesson.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      textAlign: "left",
                      padding: "9px 10px",
                      borderRadius: 9,
                      border: "none",
                      fontSize: 13,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      background: active ? "var(--orange-soft)" : "transparent",
                      color: active ? "var(--orange)" : "var(--ink)",
                      fontWeight: active ? 700 : 500,
                      transition: "background .15s ease",
                    }}
                  >
                    <LessonIcon type={lesson.type} active={active} />
                    {lesson.title}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* lesson area */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        {selectedLesson ? (
          <>
            <div style={{ flex: "none", background: "var(--card)", borderBottom: "1px solid var(--line)", padding: "16px 26px" }}>
              <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 6 }}>
                {course.title} <span style={{ color: "var(--line)" }}>/</span> {selectedChapter?.title}{" "}
                <span style={{ color: "var(--line)" }}>/</span>{" "}
                <span style={{ color: "var(--ink2)", fontWeight: 600 }}>{selectedLesson.title}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px", minWidth: 160 }}>
                  <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.4 }}>{selectedLesson.title}</div>
                </div>
                <div style={{ display: "flex", gap: 10, flex: "none", flexWrap: "wrap", marginLeft: "auto" }}>
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

            <div style={{ flex: 1, overflowY: "auto", padding: 26, display: "flex" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {viewMode === "flashcards" ? (
                  <FlashcardReview key={selectedLesson.id} lessonId={selectedLesson.id} />
                ) : (
                  <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gap: 18 }}>
                    <LessonViewer lesson={selectedLesson} />
                    {selectedLesson.aiNotesEnabled && <LessonNotes lessonId={selectedLesson.id} />}
                  </div>
                )}
              </div>

              {showChat && selectedLesson.askMeEnabled && (
                <div style={{ width: 360, flex: "none", marginLeft: 18, height: "calc(100vh - 170px)", position: "sticky", top: 0 }}>
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
