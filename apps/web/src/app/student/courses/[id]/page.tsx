"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { coursesApi, ApiError, type Chapter, type CourseTree, type Lesson } from "@/lib/api";

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
      <video
        controls
        src={lesson.contentUrl}
        style={{ width: "100%", borderRadius: "var(--rm)", background: "#000", aspectRatio: "16/9" }}
      />
    ) : (
      <div style={{ padding: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", color: "var(--ink2)" }}>
        No video uploaded yet.
      </div>
    );
  }

  if (lesson.type === "PDF") {
    return lesson.contentUrl ? (
      <iframe
        src={lesson.contentUrl}
        style={{ width: "100%", height: "70vh", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}
      />
    ) : (
      <div style={{ padding: 24, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", color: "var(--ink2)" }}>
        No PDF uploaded yet.
      </div>
    );
  }

  if (lesson.type === "LIVE") {
    return (
      <div style={{ padding: 24, background: "var(--purple-soft)", borderRadius: "var(--rm)", color: "var(--purple)" }}>
        <b>Live class</b>
        <p style={{ marginTop: 6, fontSize: 14 }}>
          {lesson.liveAt ? new Date(lesson.liveAt).toLocaleString() : "Schedule not set yet."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: "var(--amber-soft)", borderRadius: "var(--rm)", color: "var(--amber)" }}>
      Flashcards for this lesson are coming in a later step.
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
      <main style={{ padding: 40, maxWidth: 480 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>You&apos;re not enrolled in this course yet</h1>
        <p style={{ color: "var(--ink2)", marginTop: 8, marginBottom: 20 }}>Enroll to unlock the lessons.</p>
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
            <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 10 }}>
              Lesson {lessonIndex + 1} of {allLessons.length}
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
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {selectedLesson ? (
          <>
            <div style={{ flex: "none", background: "var(--card)", borderBottom: "1px solid var(--line)", padding: "16px 26px" }}>
              <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 6 }}>
                {course.title} <span style={{ color: "var(--line)" }}>/</span> {selectedChapter?.title}{" "}
                <span style={{ color: "var(--line)" }}>/</span>{" "}
                <span style={{ color: "var(--ink2)", fontWeight: 600 }}>{selectedLesson.title}</span>
              </div>
              <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.4 }}>{selectedLesson.title}</div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 26 }}>
              <div style={{ maxWidth: 1000, margin: "0 auto" }}>
                <LessonViewer lesson={selectedLesson} />
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
