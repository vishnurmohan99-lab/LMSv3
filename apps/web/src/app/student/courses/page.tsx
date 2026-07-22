"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { coursesApi, enrollmentsApi, segmentsApi, usersApi, ApiError, type Course, type CourseDifficulty, type Enrollment, type Segment, type Profile } from "@/lib/api";
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

// Real course difficulty, set by an admin. Courses left unrated show no badge rather
// than being assigned a level nobody chose.
const LEVELS: { value: CourseDifficulty; label: string; ink: string; bg: string }[] = [
  { value: "EASY", label: "Easy", ink: "var(--diff-easy)", bg: "var(--diff-easy-soft)" },
  { value: "MEDIUM", label: "Medium", ink: "var(--diff-med)", bg: "var(--diff-med-soft)" },
  { value: "HARD", label: "Hard", ink: "var(--diff-hard)", bg: "var(--diff-hard-soft)" },
];
function levelOf(course: Course) {
  return course.difficulty ? (LEVELS.find((l) => l.value === course.difficulty) ?? null) : null;
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
  const level = levelOf(course);
  return (
    <div className="entity-card fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden", animationDelay: `${index * 40}ms`, position: "relative" }}>
      <CardBanner url={course.thumbnailUrl} name={course.title} badge={badge} />
      {level && (
        <span style={{ position: "absolute", top: 10, right: 10, fontSize: 9.5, fontWeight: 700, color: level.ink, background: level.bg, borderRadius: 5, padding: "3px 8px" }}>{level.label}</span>
      )}
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
  const [sort, setSort] = useState<SortKey>("popular");
  const [selectorOpen, setSelectorOpen] = useState(false); // storefront class/track selector
  const [popSegmentId, setPopSegmentId] = useState<string | null>(null); // segment expanded in the selector
  const [applyingScope, setApplyingScope] = useState(false);

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

  const browsable = useMemo(() => {
    const sorted = browsableAll.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
    if (sort === "rating") sorted.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1));
    else if (sort === "newest") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else sorted.sort((a, b) => (b._count?.enrollments ?? 0) - (a._count?.enrollments ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    return sorted;
  }, [browsableAll, search, sort]);

  const enrolledCourses = useMemo(
    () => enrollments.map((e) => e.course).filter((c) => c.title.toLowerCase().includes(search.toLowerCase()) && courseMatchesProfile(c, profile)),
    [enrollments, search, profile],
  );

  const segmentContext = profile?.subsegmentId ? nameMap.get(profile.subsegmentId) : profile?.segmentId ? nameMap.get(profile.segmentId) : null;
  const selectorLabel = segmentContext ?? "All classes";

  // Persist a new class/track scope — the backend scopes every course list to the student's
  // profile segment, so switching here re-scopes the whole app, not just this page.
  async function applyScope(segId: string, subId: string | null) {
    setApplyingScope(true);
    setError(null);
    try {
      const updated = await usersApi.updateMe({ segmentId: segId, subsegmentId: subId });
      setProfile(updated);
      setSelectorOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to switch class");
    } finally {
      setApplyingScope(false);
    }
  }

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
    <main className="fade-in mobile-page-pad" style={{ padding: "30px 30px 60px" }}>
      <div className="mobile-stack-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.7 }}>My Courses</div>
          {segments.length > 0 && (
            <div style={{ position: "relative", marginTop: 6, width: "max-content" }}>
              <button
                onClick={() => {
                  setPopSegmentId(profile?.segmentId ?? segments[0]?.id ?? null);
                  setSelectorOpen((o) => !o);
                }}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, height: 34, padding: "0 12px", cursor: "pointer", fontFamily: "inherit" }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 3, background: "var(--purple)", flex: "none" }} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{selectorLabel}</span>
                <span style={{ fontSize: 9, color: "var(--ink2)" }}>{selectorOpen ? "▲" : "▼"}</span>
              </button>
              {selectorOpen && (
                <>
                  <div onClick={() => setSelectorOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
                  <div
                    className="pop-in"
                    style={{ position: "absolute", left: 0, top: 40, width: 360, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "0 20px 48px rgba(28,22,15,.16)", padding: 8, zIndex: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
                  >
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, fontFamily: "var(--font-mono)", color: "var(--ink3)", padding: "7px 10px 5px" }}>YOUR CLASS</div>
                      {segments.map((s) => {
                        const active = profile?.segmentId === s.id;
                        const expanded = popSegmentId === s.id;
                        const hasTracks = s.subsegments.length > 0;
                        return (
                          <button
                            key={s.id}
                            onClick={() => (hasTracks ? setPopSegmentId(s.id) : applyScope(s.id, null))}
                            disabled={applyingScope}
                            style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", padding: "8px 10px", border: "none", borderRadius: 8, background: expanded ? "var(--line2)" : "transparent", color: active ? "var(--orange-deep)" : "var(--ink)", fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: "inherit", cursor: "pointer" }}
                          >
                            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                            {active && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--orange-deep)" }}>✓</span>}
                            {hasTracks && <span style={{ fontSize: 9, color: "var(--ink3)" }}>›</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ borderLeft: "1px solid var(--line2)", paddingLeft: 6 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, fontFamily: "var(--font-mono)", color: "var(--ink3)", padding: "7px 10px 5px" }}>TRACK</div>
                      {(() => {
                        const popSeg = segments.find((s) => s.id === popSegmentId);
                        if (!popSeg || popSeg.subsegments.length === 0) {
                          return <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--ink3)", padding: "8px 10px" }}>No tracks for this class — you&apos;ll see everything for {popSeg?.name ?? "it"}.</div>;
                        }
                        return (
                          <>
                            <button
                              onClick={() => applyScope(popSeg.id, null)}
                              disabled={applyingScope}
                              style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", padding: "8px 10px", border: "none", borderRadius: 8, background: "transparent", color: profile?.segmentId === popSeg.id && !profile?.subsegmentId ? "var(--orange-deep)" : "var(--ink)", fontSize: 12.5, fontWeight: 500, fontFamily: "inherit", cursor: "pointer" }}
                            >
                              <span style={{ flex: 1 }}>All of {popSeg.name}</span>
                              {profile?.segmentId === popSeg.id && !profile?.subsegmentId && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--orange-deep)" }}>✓</span>}
                            </button>
                            {popSeg.subsegments.map((sub) => {
                              const active = profile?.subsegmentId === sub.id;
                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => applyScope(popSeg.id, sub.id)}
                                  disabled={applyingScope}
                                  style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", padding: "8px 10px", border: "none", borderRadius: 8, background: "transparent", color: active ? "var(--orange-deep)" : "var(--ink)", fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: "inherit", cursor: "pointer" }}
                                >
                                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.name}</span>
                                  {active && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--orange-deep)" }}>✓</span>}
                                </button>
                              );
                            })}
                          </>
                        );
                      })()}
                      <div style={{ fontSize: 10.5, lineHeight: 1.5, color: "var(--ink3)", padding: "8px 10px 4px", borderTop: "1px solid var(--line2)", marginTop: 6 }}>Content updates instantly.</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
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

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink2)" }}>
                  {browsable.length} course{browsable.length === 1 ? "" : "s"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>
                    {search ? "No courses match your search" : "No courses available yet"}
                  </div>
                  <div style={{ fontSize: 13 }}>{search ? "Try a different search term." : "Check back soon."}</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
                  {browsable.map((course, i) => (
                    <CatalogCard key={course.id} course={course} badge={badgeFor(course)} onEnroll={onEnroll} enrolling={enrollingId === course.id} index={i} />
                  ))}
                </div>
              )}
            </div>
        </>
      )}

    </main>
  );
}
