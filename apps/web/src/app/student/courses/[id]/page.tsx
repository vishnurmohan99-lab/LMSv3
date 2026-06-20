"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { coursesApi, ApiError, type CourseTree, type Lesson } from "@/lib/api";
import FlashcardReview from "@/components/FlashcardReview";

function LessonViewer({ lesson }: { lesson: Lesson }) {
  if (lesson.type === "VIDEO") {
    return lesson.contentUrl ? (
      <video controls src={lesson.contentUrl} style={{ width: "100%", borderRadius: 14, background: "#000" }} />
    ) : (
      <p style={{ color: "var(--ink2)" }}>No video uploaded yet.</p>
    );
  }

  if (lesson.type === "PDF") {
    return lesson.contentUrl ? (
      <iframe src={lesson.contentUrl} style={{ width: "100%", height: "70vh", border: "1px solid var(--line)", borderRadius: 14 }} />
    ) : (
      <p style={{ color: "var(--ink2)" }}>No PDF uploaded yet.</p>
    );
  }

  if (lesson.type === "LIVE") {
    return (
      <div style={{ padding: 24, background: "var(--purple-soft)", borderRadius: 14, color: "var(--purple)" }}>
        <b>Live class</b>
        <p style={{ marginTop: 6, fontSize: 14 }}>
          {lesson.liveAt ? new Date(lesson.liveAt).toLocaleString() : "Schedule not set yet."}
        </p>
      </div>
    );
  }

  return <FlashcardReview lessonId={lesson.id} />;
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

  const selectedLesson = course.chapters.flatMap((c) => c.lessons).find((l) => l.id === selectedLessonId) ?? null;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 280, borderRight: "1px solid var(--line)", padding: 24, overflowY: "auto" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{course.title}</h2>
        {course.chapters.map((chapter) => (
          <div key={chapter.id} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", marginBottom: 8 }}>
              {chapter.title}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {chapter.lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  onClick={() => setSelectedLessonId(lesson.id)}
                  style={{
                    textAlign: "left",
                    padding: "9px 10px",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 13,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    background: lesson.id === selectedLessonId ? "var(--orange-soft)" : "transparent",
                    color: lesson.id === selectedLessonId ? "var(--orange)" : "var(--ink)",
                    fontWeight: lesson.id === selectedLessonId ? 700 : 500,
                  }}
                >
                  {lesson.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>

      <main style={{ flex: 1, padding: 40 }}>
        {selectedLesson ? (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 18 }}>{selectedLesson.title}</h1>
            <LessonViewer lesson={selectedLesson} />
          </>
        ) : (
          <p style={{ color: "var(--ink2)" }}>This course has no lessons yet.</p>
        )}
      </main>
    </div>
  );
}
