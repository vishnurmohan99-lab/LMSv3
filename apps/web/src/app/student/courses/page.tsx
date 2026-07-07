"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { coursesApi, enrollmentsApi, segmentsApi, usersApi, ApiError, type Course, type Enrollment, type Segment, type Profile } from "@/lib/api";
import { useImageLightbox } from "@/components/ImageLightboxProvider";

const BANNER_HEIGHT = 130;

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

/** "Free" for FREE courses / no price; else ₹ in whole rupees (priceCents = paise). */
function formatPrice(course: Course) {
  if (course.type === "FREE" || course.priceCents == null || course.priceCents === 0) return "Free";
  return `₹${Math.round(course.priceCents / 100).toLocaleString("en-IN")}`;
}

function formatDuration(minutes: number | null) {
  if (!minutes) return null;
  const h = minutes / 60;
  if (h >= 1) return `${Number.isInteger(h) ? h : h.toFixed(1)} hrs`;
  return `${minutes} min`;
}

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  const full = Math.round(rating);
  return (
    <span style={{ color: "var(--amber)", fontSize: size, letterSpacing: 1, lineHeight: 1 }} aria-label={`${rating} out of 5`}>
      {"★".repeat(full)}
      <span style={{ color: "var(--line)" }}>{"★".repeat(5 - full)}</span>
    </span>
  );
}

function RatingMeta({ course }: { course: Course }) {
  const price = formatPrice(course);
  const duration = formatDuration(course.durationMinutes);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--ink3)", fontWeight: 600 }}>
      {course.avgRating != null ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Stars rating={course.avgRating} size={12} />
          <span style={{ color: "var(--ink2)", fontWeight: 700 }}>{course.avgRating.toFixed(1)}</span>
          {course.reviewCount ? <span>({course.reviewCount})</span> : null}
        </span>
      ) : (
        <span style={{ color: "var(--ink3)" }}>No ratings yet</span>
      )}
      {duration && <span>· {duration}</span>}
      <span style={{ marginLeft: "auto", fontWeight: 800, color: price === "Free" ? "var(--green)" : "var(--ink)" }}>{price}</span>
    </div>
  );
}

function CardBanner({ url, name, badge }: { url: string | null; name: string; badge?: string | null }) {
  const openImage = useImageLightbox();
  const badgeChip = badge ? (
    <span
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.4,
        color: "#fff",
        background: "rgba(28,25,21,.62)",
        backdropFilter: "blur(4px)",
        padding: "4px 9px",
        borderRadius: 999,
      }}
    >
      {badge}
    </span>
  ) : null;

  if (url) {
    return (
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openImage(url, name);
        }}
        style={{ position: "relative", height: BANNER_HEIGHT, background: `url(${url}) center/cover`, cursor: "pointer" }}
      >
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,.45))" }} />
        {badgeChip}
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
          style={{ width: 50, height: 50, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 17 }}
        >
          {initials(name)}
        </div>
      </div>
      {badgeChip}
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

function EnrolledCard({ course, badge, index }: { course: Course; badge: string | null; index: number }) {
  return (
    <Link
      href={`/student/courses/${course.id}`}
      className="entity-card fade-in-up"
      style={{ display: "block", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden", animationDelay: `${index * 40}ms` }}
    >
      <CardBanner url={course.thumbnailUrl} name={course.title} badge={badge} />
      <div style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{course.title}</div>
        <RatingMeta course={course} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--orange-deep)", background: "var(--orange-soft)", padding: "4px 10px", borderRadius: 7 }}>Enrolled</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#fff", background: "var(--ink)", padding: "8px 16px", borderRadius: 999 }}>
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

function CatalogCard({ course, badge, onEnroll, enrolling, index }: { course: Course; badge: string | null; onEnroll: (id: string) => void; enrolling: boolean; index: number }) {
  const paid = course.type === "PAID";
  return (
    <div className="entity-card fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden", animationDelay: `${index * 40}ms` }}>
      <CardBanner url={course.thumbnailUrl} name={course.title} badge={badge} />
      <div style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, minHeight: 20 }}>{course.title}</div>
        {course.description && <p style={{ fontSize: 12.5, color: "var(--ink2)", marginBottom: 12, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{course.description}</p>}
        <div style={{ marginBottom: 14 }}>
          <RatingMeta course={course} />
        </div>
        <button
          onClick={() => onEnroll(course.id)}
          disabled={enrolling || paid}
          title={paid ? "Paid course — enrol via a subscription or your admin" : undefined}
          style={{
            width: "100%",
            padding: "11px 16px",
            background: paid ? "var(--bg-sunk)" : "var(--ink)",
            color: paid ? "var(--ink2)" : "#fff",
            border: paid ? "1px solid var(--line)" : "none",
            borderRadius: "var(--rs)",
            fontSize: 13.5,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: enrolling || paid ? "default" : "pointer",
            opacity: enrolling ? 0.7 : 1,
          }}
        >
          {paid ? "Subscription required" : enrolling ? "Enrolling…" : "Enroll now"}
        </button>
      </div>
    </div>
  );
}

/** Mirrors the backend per-student segment match (CoursesService.listCourses). */
function courseMatchesProfile(course: Course, profile: Profile | null) {
  if (!profile?.segmentId) return true;
  if (profile.subsegmentId) return course.subsegmentId === profile.subsegmentId;
  return course.segmentId === profile.segmentId && !course.subsegmentId;
}

type SortKey = "popular" | "rating" | "newest";

export default function StudentCoursesPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [catalog, setCatalog] = useState<Course[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null); // segmentId | subsegmentId
  const [freeOnly, setFreeOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("popular");
  const [filtersOpen, setFiltersOpen] = useState(false); // mobile sheet

  function load() {
    setLoading(true);
    setError(null);
    Promise.allSettled([enrollmentsApi.mine(), coursesApi.list(), segmentsApi.list(), usersApi.me()])
      .then(([enrollmentsResult, catalogResult, segmentsResult, profileResult]) => {
        if (enrollmentsResult.status === "fulfilled") setEnrollments(enrollmentsResult.value);
        if (catalogResult.status === "fulfilled") setCatalog(catalogResult.value);
        if (segmentsResult.status === "fulfilled") setSegments(segmentsResult.value);
        if (profileResult.status === "fulfilled") setProfile(profileResult.value);
        const failed = [enrollmentsResult, catalogResult, segmentsResult, profileResult].find((r) => r.status === "rejected");
        if (failed && failed.status === "rejected") {
          const err = failed.reason;
          setError(err instanceof ApiError ? err.message : "Some course data failed to load");
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // segmentId/subsegmentId → display name, for card badges + filter labels.
  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of segments) {
      m.set(s.id, s.name);
      for (const sub of s.subsegments) m.set(sub.id, sub.name);
    }
    return m;
  }, [segments]);

  function badgeFor(course: Course): string | null {
    const seg = (course.segmentId ? nameMap.get(course.segmentId) : null) ?? null;
    const sub = (course.subsegmentId ? nameMap.get(course.subsegmentId) : null) ?? null;
    return sub ? (seg ? `${seg} · ${sub}` : sub) : seg;
  }

  const enrolledIds = new Set(enrollments.map((e) => e.courseId));
  const browsableAll = catalog.filter((c) => !enrolledIds.has(c.id));

  // Subject facets from the catalog (segment or subsegment, whichever the course is tagged to), with counts.
  const subjectFacets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of browsableAll) {
      const key = c.subsegmentId ?? c.segmentId;
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, name: nameMap.get(id) ?? "Other", count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [browsableAll, nameMap]);

  const browsable = useMemo(() => {
    let list = browsableAll.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
    if (subjectFilter) list = list.filter((c) => (c.subsegmentId ?? c.segmentId) === subjectFilter);
    if (freeOnly) list = list.filter((c) => c.type === "FREE" || !c.priceCents);
    const sorted = [...list];
    if (sort === "rating") sorted.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1));
    else if (sort === "newest") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else sorted.sort((a, b) => (b._count?.enrollments ?? 0) - (a._count?.enrollments ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    return sorted;
  }, [browsableAll, search, subjectFilter, freeOnly, sort]);

  const enrolledCourses = useMemo(
    () => enrollments.map((e) => e.course).filter((c) => c.title.toLowerCase().includes(search.toLowerCase()) && courseMatchesProfile(c, profile)),
    [enrollments, search, profile],
  );

  const nActive = (subjectFilter ? 1 : 0) + (freeOnly ? 1 : 0);
  const segmentContext = profile?.subsegmentId ? nameMap.get(profile.subsegmentId) : profile?.segmentId ? nameMap.get(profile.segmentId) : null;

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

  function clearFilters() {
    setSubjectFilter(null);
    setFreeOnly(false);
  }

  const filterPanel = (
    <div style={{ display: "grid", gap: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Filters</div>
        {nActive > 0 && (
          <button onClick={clearFilters} style={{ fontSize: 12, fontWeight: 700, color: "var(--orange)", background: "none", border: "none", cursor: "pointer" }}>
            Clear all
          </button>
        )}
      </div>

      {subjectFacets.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--ink3)", marginBottom: 10 }}>Subject</div>
          <div style={{ display: "grid", gap: 6 }}>
            {subjectFacets.map((f) => {
              const on = subjectFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setSubjectFilter(on ? null : f.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: "var(--rs)",
                    border: on ? "1px solid var(--orange)" : "1px solid var(--line)",
                    background: on ? "var(--orange-soft)" : "var(--card)",
                    color: on ? "var(--orange-deep)" : "var(--ink2)",
                    fontSize: 13,
                    fontWeight: on ? 700 : 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <span>{f.name}</span>
                  <span style={{ fontSize: 11, color: on ? "var(--orange-deep)" : "var(--ink3)" }}>{f.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--ink3)", marginBottom: 10 }}>Price</div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--ink2)" }}>
          <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--orange)" }} />
          Free only
        </label>
      </div>
    </div>
  );

  return (
    <main className="fade-in mobile-page-pad" style={{ padding: "30px 30px 60px" }}>
      <div className="mobile-stack-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.7 }}>My Courses</div>
          {segmentContext && <div style={{ fontSize: 13, color: "var(--ink3)", fontWeight: 600, marginTop: 2 }}>Scoped to {segmentContext}</div>}
        </div>
        <div className="mobile-full-width" style={{ position: "relative", flex: "1 1 320px", maxWidth: 420 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a course that interests you"
            style={{ width: "100%", padding: "11px 44px 11px 18px", border: "1px solid var(--line)", borderRadius: 999, fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "var(--card)" }}
          />
          <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }}>
            <SearchIcon />
          </div>
        </div>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="dash-skeleton" style={{ height: 260 }} />
          ))}
        </div>
      ) : (
        <>
          {enrolledCourses.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Continue learning</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
                {enrolledCourses.map((course, i) => (
                  <EnrolledCard key={course.id} course={course} badge={badgeFor(course)} index={i} />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "232px 1fr", gap: 26, alignItems: "start" }} className="catalog-shell">
            {/* Filter sidebar (desktop) */}
            <aside className="catalog-filters" style={{ position: "sticky", top: 20 }}>
              {filterPanel}
            </aside>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink2)" }}>
                  {browsable.length} course{browsable.length === 1 ? "" : "s"}
                  {subjectFilter && <span style={{ color: "var(--ink3)", fontWeight: 600 }}> in {nameMap.get(subjectFilter)}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    className="catalog-filter-toggle"
                    onClick={() => setFiltersOpen(true)}
                    style={{ display: "none", alignItems: "center", gap: 6, padding: "8px 14px", border: "1px solid var(--line)", background: "var(--card)", borderRadius: "var(--rs)", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
                  >
                    Filters{nActive > 0 ? ` · ${nActive}` : ""}
                  </button>
                  <span style={{ fontSize: 12.5, color: "var(--ink3)", fontWeight: 600 }}>Sort</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "var(--rs)", fontSize: 13, fontFamily: "inherit", background: "var(--card)", fontWeight: 600, cursor: "pointer" }}
                  >
                    <option value="popular">Most popular</option>
                    <option value="rating">Highest rated</option>
                    <option value="newest">Newest</option>
                  </select>
                </div>
              </div>

              {enrollments.length === 0 && enrolledCourses.length === 0 && (
                <p style={{ color: "var(--ink2)", marginBottom: 20, fontSize: 13.5 }}>You haven&apos;t enrolled in any courses yet — browse below.</p>
              )}

              {browsable.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--ink3)" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>No courses match these filters</div>
                  <div style={{ fontSize: 13 }}>Try clearing filters or a different search.</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
                  {browsable.map((course, i) => (
                    <CatalogCard key={course.id} course={course} badge={badgeFor(course)} onEnroll={onEnroll} enrolling={enrollingId === course.id} index={i} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Mobile filter sheet */}
      {filtersOpen && (
        <div onClick={() => setFiltersOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,18,16,.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="pop-in"
            style={{ background: "var(--card)", width: "100%", borderRadius: "var(--rl) var(--rl) 0 0", padding: "22px 20px 30px", maxHeight: "80vh", overflowY: "auto" }}
          >
            {filterPanel}
            <button
              onClick={() => setFiltersOpen(false)}
              style={{ width: "100%", marginTop: 22, padding: "12px", background: "var(--ink)", color: "#fff", border: "none", borderRadius: "var(--rs)", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
            >
              Show {browsable.length} course{browsable.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
