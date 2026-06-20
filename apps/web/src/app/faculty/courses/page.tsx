"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { coursesApi, segmentsApi, uploadsApi, ApiError, type Course, type Segment } from "@/lib/api";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
};

export default function FacultyCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [subsegmentId, setSubsegmentId] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const thumbnailUrl = bannerFile ? await uploadsApi.uploadFile(bannerFile) : undefined;
      await coursesApi.create({ title, segmentId, subsegmentId: subsegmentId || undefined, thumbnailUrl });
      setTitle("");
      setSegmentId("");
      setSubsegmentId("");
      setBannerFile(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create course");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main style={{ padding: "30px 40px 60px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, marginBottom: 22 }}>My Courses</div>

      <form
        onSubmit={onCreate}
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 22,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rm)",
          padding: 16,
        }}
      >
        <input
          required
          placeholder="New course title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ ...inputStyle, flex: "1 1 200px" }}
        />
        <select
          required
          value={segmentId}
          onChange={(e) => {
            setSegmentId(e.target.value);
            setSubsegmentId("");
          }}
          style={inputStyle}
        >
          <option value="" disabled>
            Select segment
          </option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {selectedSegment && selectedSegment.subsegments.length > 0 && (
          <select value={subsegmentId} onChange={(e) => setSubsegmentId(e.target.value)} style={inputStyle}>
            <option value="">No sub-segment</option>
            {selectedSegment.subsegments.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
          style={{ fontSize: 13, alignSelf: "center" }}
          title="Banner image (optional)"
        />
        <button
          type="submit"
          disabled={creating}
          style={{
            padding: "10px 18px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: creating ? "default" : "pointer",
            opacity: creating ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {creating ? "Creating…" : "Create course"}
        </button>
      </form>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {!loading && segments.length === 0 && (
        <p style={{ color: "var(--amber)", fontSize: 13, marginBottom: 16 }}>
          No segments exist yet — ask an admin to create one before you can add new courses.
        </p>
      )}

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
                {c.description && <p style={{ color: "var(--ink2)", fontSize: 13, marginTop: 6 }}>{c.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
