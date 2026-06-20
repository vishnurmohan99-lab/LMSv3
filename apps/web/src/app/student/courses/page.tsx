"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { coursesApi, enrollmentsApi, segmentsApi, ApiError, type Course, type Enrollment, type Segment } from "@/lib/api";

function CourseCard({ course, onEnroll, enrolling }: { course: Course; onEnroll: (id: string) => void; enrolling: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 18,
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--rm)",
      }}
    >
      <div>
        <span style={{ fontWeight: 700 }}>{course.title}</span>
        {course.description && <p style={{ color: "var(--ink2)", fontSize: 13, marginTop: 6 }}>{course.description}</p>}
      </div>
      <button
        onClick={() => onEnroll(course.id)}
        disabled={enrolling}
        style={{
          padding: "9px 18px",
          background: "var(--ink)",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: enrolling ? "default" : "pointer",
          opacity: enrolling ? 0.7 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {enrolling ? "Enrolling…" : "Enroll"}
      </button>
    </div>
  );
}

export default function StudentCoursesPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [catalog, setCatalog] = useState<Course[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([enrollmentsApi.mine(), coursesApi.list(), segmentsApi.list()])
      .then(([myEnrollments, allCourses, allSegments]) => {
        setEnrollments(myEnrollments);
        setCatalog(allCourses);
        setSegments(allSegments);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load courses"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const enrolledIds = new Set(enrollments.map((e) => e.courseId));
  const browsable = catalog.filter((c) => !enrolledIds.has(c.id));

  const knownSegmentIds = new Set(segments.map((s) => s.id));
  const uncategorized = browsable.filter((c) => !c.segmentId || !knownSegmentIds.has(c.segmentId));

  async function onEnroll(courseId: string) {
    setEnrollingId(courseId);
    try {
      await coursesApi.enroll(courseId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to enroll");
    } finally {
      setEnrollingId(null);
    }
  }

  return (
    <main style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 22 }}>My Courses</div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : (
        <>
          {enrollments.length === 0 ? (
            <p style={{ color: "var(--ink2)" }}>
              You haven&apos;t enrolled in any courses yet — browse the catalog below.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {enrollments.map(({ course }) => (
                <Link
                  key={course.id}
                  href={`/student/courses/${course.id}`}
                  style={{
                    display: "block",
                    padding: 18,
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--rm)",
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{course.title}</span>
                  {course.description && (
                    <p style={{ color: "var(--ink2)", fontSize: 13, marginTop: 6 }}>{course.description}</p>
                  )}
                </Link>
              ))}
            </div>
          )}

          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginTop: 40, marginBottom: 16 }}>
            Catalog
          </div>

          {browsable.length === 0 ? (
            <p style={{ color: "var(--ink2)" }}>No new courses to browse right now.</p>
          ) : (
            <div style={{ display: "grid", gap: 28 }}>
              {segments.map((segment) => {
                const directCourses = browsable.filter((c) => c.segmentId === segment.id && !c.subsegmentId);
                const subsegmentGroups = segment.subsegments
                  .map((sub) => ({ sub, courses: browsable.filter((c) => c.subsegmentId === sub.id) }))
                  .filter((g) => g.courses.length > 0);

                if (directCourses.length === 0 && subsegmentGroups.length === 0) return null;

                return (
                  <div key={segment.id}>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{segment.name}</div>

                    {directCourses.length > 0 && (
                      <div style={{ display: "grid", gap: 12, marginBottom: subsegmentGroups.length > 0 ? 20 : 0 }}>
                        {directCourses.map((course) => (
                          <CourseCard key={course.id} course={course} onEnroll={onEnroll} enrolling={enrollingId === course.id} />
                        ))}
                      </div>
                    )}

                    {subsegmentGroups.map(({ sub, courses }) => (
                      <div key={sub.id} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 10 }}>
                          {sub.name}
                        </div>
                        <div style={{ display: "grid", gap: 12 }}>
                          {courses.map((course) => (
                            <CourseCard key={course.id} course={course} onEnroll={onEnroll} enrolling={enrollingId === course.id} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {uncategorized.length > 0 && (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: "var(--ink2)" }}>
                    Uncategorized
                  </div>
                  <div style={{ display: "grid", gap: 12 }}>
                    {uncategorized.map((course) => (
                      <CourseCard key={course.id} course={course} onEnroll={onEnroll} enrolling={enrollingId === course.id} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
