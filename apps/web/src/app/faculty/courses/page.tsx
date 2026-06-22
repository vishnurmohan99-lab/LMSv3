"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { coursesApi, segmentsApi, uploadsApi, ApiError, type Course, type Segment } from "@/lib/api";
import Modal from "@/components/Modal";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
  width: "100%",
};

export default function FacultyCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [subsegmentId, setSubsegmentId] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([coursesApi.list(), segmentsApi.list()])
      .then(([c, s]) => {
        setCourses(c);
        setSegments(s);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load courses"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const selectedSegment = segments.find((s) => s.id === segmentId);

  function openAdd() {
    setTitle("");
    setSegmentId("");
    setSubsegmentId("");
    setBannerFile(null);
    setError(null);
    setShowAddModal(true);
  }

  const requiresSubsegment = !!selectedSegment && selectedSegment.subsegments.length > 0;
  const canCreate = title.trim().length > 0 && (!requiresSubsegment || !!subsegmentId);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setError(null);
    setCreating(true);
    try {
      const thumbnailUrl = bannerFile ? await uploadsApi.uploadFile(bannerFile) : undefined;
      await coursesApi.create({ title, segmentId: segmentId || undefined, subsegmentId: subsegmentId || undefined, thumbnailUrl });
      setShowAddModal(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create course");
    } finally {
      setCreating(false);
    }
  }

  function categoryLabel(course: Course): string {
    if (!course.segmentId) return "Uncategorized";
    const segment = segments.find((s) => s.id === course.segmentId);
    if (!segment) return "Uncategorized";
    const subsegment = segment.subsegments.find((sub) => sub.id === course.subsegmentId);
    return subsegment ? `${segment.name} / ${subsegment.name}` : segment.name;
  }

  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>My Courses</div>
        <button
          onClick={openAdd}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          + Add course
        </button>
      </div>

      {showAddModal && (
        <Modal title="Add course" onClose={() => setShowAddModal(false)}>
          <form onSubmit={onCreate}>
            <input
              required
              autoFocus
              placeholder="Course name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ ...inputStyle, marginBottom: 12 }}
            />

            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)" }}>Segment (optional)</label>
            <select
              value={segmentId}
              onChange={(e) => {
                setSegmentId(e.target.value);
                setSubsegmentId("");
              }}
              style={{ ...inputStyle, marginTop: 8, marginBottom: 12 }}
            >
              <option value="">Uncategorized</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {requiresSubsegment && (
              <>
                <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)" }}>Subsegment</label>
                <select required value={subsegmentId} onChange={(e) => setSubsegmentId(e.target.value)} style={{ ...inputStyle, marginTop: 8, marginBottom: 12 }}>
                  <option value="">Select subsegment…</option>
                  {selectedSegment!.subsegments.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Banner image (optional)</div>
              <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
            </div>

            <p style={{ color: "var(--ink3)", fontSize: 12, marginBottom: 16 }}>
              You can change the segment, or set the course to Paid/Private, any time from the course page.
            </p>

            <button
              type="submit"
              disabled={creating || !canCreate}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "11px 18px",
                background: "var(--ink)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: creating || !canCreate ? "default" : "pointer",
                opacity: creating || !canCreate ? 0.7 : 1,
              }}
            >
              {creating ? "Creating…" : "Create course"}
            </button>
            {error && <p style={{ color: "var(--red)", fontSize: 12.5, marginTop: 10 }}>{error}</p>}
          </form>
        </Modal>
      )}

      {error && !showAddModal && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : courses.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No courses yet. Create your first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/faculty/courses/${c.id}`}
              className="entity-card"
              style={{
                display: "block",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rl)",
                overflow: "hidden",
              }}
            >
              {c.thumbnailUrl ? (
                <div style={{ position: "relative", height: 110, background: `url(${c.thumbnailUrl}) center/cover` }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,.45))" }} />
                </div>
              ) : (
                <div className="banner-gradient-dark" style={{ position: "relative", height: 110, overflow: "hidden" }}>
                  <div
                    style={{
                      position: "absolute",
                      right: -30,
                      bottom: -30,
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(242,106,27,.35), transparent 70%)",
                    }}
                  />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div
                      className="banner-gradient-orange"
                      style={{ width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}
                    >
                      {c.title.trim().slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                </div>
              )}
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700 }}>{c.title}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: c.published ? "var(--green-soft)" : "var(--amber-soft)",
                      color: c.published ? "var(--green)" : "var(--amber)",
                    }}
                  >
                    {c.published ? "Published" : "Draft"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: c.segmentId ? "var(--ink2)" : "var(--ink3)", marginTop: 6 }}>{categoryLabel(c)}</div>
                {c.description && <p style={{ color: "var(--ink2)", fontSize: 13, marginTop: 6 }}>{c.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
