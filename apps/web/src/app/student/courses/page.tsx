"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { coursesApi, enrollmentsApi, segmentsApi, ApiError, type Course, type Enrollment, type Segment } from "@/lib/api";

const BANNER_HEIGHT = 130;

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function CardBanner({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <div style={{ position: "relative", height: BANNER_HEIGHT, background: `url(${url}) center/cover` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,.45))" }} />
      </div>
    );
  }
  return (
    <div className="banner-gradient-dark" style={{ position: "relative", height: BANNER_HEIGHT, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          right: -30,
          bottom: -30,
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(242,106,27,.35), transparent 70%)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          className="banner-gradient-orange"
          style={{
            width: 50,
            height: 50,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          {initials(name)}
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function EnrolledCard({ course, index }: { course: Course; index: number }) {
  return (
    <Link
      href={`/student/courses/${course.id}`}
      className="entity-card fade-in-up"
      style={{
        display: "block",
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--rl)",
        overflow: "hidden",
        animationDelay: `${index * 40}ms`,
      }}
    >
      <CardBanner url={course.thumbnailUrl} name={course.title} />
      <div style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{course.title}</div>
        {course.description && (
          <p style={{ fontSize: 12.5, color: "var(--ink2)", marginBottom: 14, lineHeight: 1.5 }}>{course.description}</p>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--orange)", background: "var(--orange-soft)", padding: "4px 10px", borderRadius: 7 }}>
            Enrolled
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: "#fff",
              background: "var(--ink)",
              padding: "8px 16px",
              borderRadius: 999,
            }}
          >
            Continue
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

function CatalogCard({ course, onEnroll, enrolling, index }: { course: Course; onEnroll: (id: string) => void; enrolling: boolean; index: number }) {
  return (
    <div
      className="entity-card fade-in-up"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--rl)",
        overflow: "hidden",
        animationDelay: `${index * 40}ms`,
      }}
    >
      <CardBanner url={course.thumbnailUrl} name={course.title} />
      <div style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{course.title}</div>
        {course.description && (
          <p style={{ fontSize: 12.5, color: "var(--ink2)", marginBottom: 14, lineHeight: 1.5 }}>{course.description}</p>
        )}
        <button
          onClick={() => onEnroll(course.id)}
          disabled={enrolling}
          style={{
            width: "100%",
            padding: "11px 16px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 11,
            fontSize: 13.5,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: enrolling ? "default" : "pointer",
            opacity: enrolling ? 0.7 : 1,
          }}
        >
          {enrolling ? "Enrolling…" : "Enroll now"}
        </button>
      </div>
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
  const [search, setSearch] = useState("");

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
  const browsableAll = catalog.filter((c) => !enrolledIds.has(c.id));
  const browsable = useMemo(
    () => browsableAll.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())),
    [browsableAll, search],
  );
  const enrolledCourses = useMemo(
    () => enrollments.map((e) => e.course).filter((c) => c.title.toLowerCase().includes(search.toLowerCase())),
    [enrollments, search],
  );

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
    <main className="fade-in" style={{ padding: "30px 30px 60px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>My Courses</div>
        <div style={{ position: "relative", flex: "1 1 320px", maxWidth: 420 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a course that interests you"
            style={{
              width: "100%",
              padding: "11px 44px 11px 18px",
              border: "1px solid var(--line)",
              borderRadius: 999,
              fontSize: 13.5,
              fontFamily: "inherit",
              outline: "none",
              background: "var(--card)",
            }}
          />
          <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }}>
            <SearchIcon />
          </div>
        </div>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : (
        <>
          {enrolledCourses.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Continue learning</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
                {enrolledCourses.map((course, i) => (
                  <EnrolledCard key={course.id} course={course} index={i} />
                ))}
              </div>
            </div>
          )}

          {enrollments.length === 0 && (
            <p style={{ color: "var(--ink2)", marginBottom: 32 }}>
              You haven&apos;t enrolled in any courses yet — browse the catalog below.
            </p>
          )}

          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Catalog</div>

          {browsable.length === 0 ? (
            <p style={{ color: "var(--ink2)" }}>No new courses to browse right now.</p>
          ) : (
            <div style={{ display: "grid", gap: 30 }}>
              {segments.map((segment) => {
                const directCourses = browsable.filter((c) => c.segmentId === segment.id && !c.subsegmentId);
                const subsegmentGroups = segment.subsegments
                  .map((sub) => ({ sub, courses: browsable.filter((c) => c.subsegmentId === sub.id) }))
                  .filter((g) => g.courses.length > 0);

                if (directCourses.length === 0 && subsegmentGroups.length === 0) return null;

                return (
                  <div key={segment.id}>
                    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: "var(--ink)" }}>{segment.name}</div>

                    {directCourses.length > 0 && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                          gap: 18,
                          marginBottom: subsegmentGroups.length > 0 ? 22 : 0,
                        }}
                      >
                        {directCourses.map((course, i) => (
                          <CatalogCard key={course.id} course={course} onEnroll={onEnroll} enrolling={enrollingId === course.id} index={i} />
                        ))}
                      </div>
                    )}

                    {subsegmentGroups.map(({ sub, courses }) => (
                      <div key={sub.id} style={{ marginBottom: 22 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 10 }}>{sub.name}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
                          {courses.map((course, i) => (
                            <CatalogCard key={course.id} course={course} onEnroll={onEnroll} enrolling={enrollingId === course.id} index={i} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {uncategorized.length > 0 && (
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: "var(--ink2)" }}>Uncategorized</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
                    {uncategorized.map((course, i) => (
                      <CatalogCard key={course.id} course={course} onEnroll={onEnroll} enrolling={enrollingId === course.id} index={i} />
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
