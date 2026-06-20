"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { coursesApi, segmentsApi, uploadsApi, ApiError, type Course, type Segment } from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";

const BANNER_HEIGHT = 64;

function CardBanner({ url }: { url: string | null }) {
  return (
    <div
      style={{
        height: BANNER_HEIGHT,
        borderRadius: "var(--rm) var(--rm) 0 0",
        background: url ? `url(${url}) center/cover` : "var(--bg)",
        border: "1px solid var(--line)",
        borderBottom: "none",
      }}
    />
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
};

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.8">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");

  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState("");
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

  function categoryLabel(course: Course): string {
    if (!course.segmentId) return "Uncategorized";
    const segment = segments.find((s) => s.id === course.segmentId);
    if (!segment) return "Uncategorized";
    const subsegment = segment.subsegments.find((sub) => sub.id === course.subsegmentId);
    return subsegment ? `${segment.name} / ${subsegment.name}` : segment.name;
  }

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (statusFilter === "PUBLISHED" && !c.published) return false;
      if (statusFilter === "DRAFT" && c.published) return false;
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [courses, search, statusFilter]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const thumbnailUrl = bannerFile ? await uploadsApi.uploadFile(bannerFile) : undefined;
      await coursesApi.create({ title, thumbnailUrl });
      setTitle("");
      setBannerFile(null);
      setShowAddModal(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create course");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Courses</div>
        <button
          onClick={() => setShowAddModal(true)}
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
          <PlusIcon />
          Add course
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
              style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
            />
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>
                Banner image (optional)
              </div>
              <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
            </div>
            <p style={{ color: "var(--ink3)", fontSize: 12, marginBottom: 16 }}>
              Courses start uncategorized — assign them to a segment or sub-segment from the Segments page.
            </p>
            <button
              type="submit"
              disabled={creating}
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
                cursor: creating ? "default" : "pointer",
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating && <Spinner />}
              {creating ? "Creating…" : "Create course"}
            </button>
          </form>
        </Modal>
      )}

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          placeholder="Search courses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} style={inputStyle}>
          <option value="ALL">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : filteredCourses.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No courses match.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {filteredCourses.map((c) => (
            <div
              key={c.id}
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rm)",
                overflow: "hidden",
              }}
            >
              <CardBanner url={c.thumbnailUrl} />
              <div style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{c.title}</div>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 8,
                    marginBottom: 8,
                    background: c.published ? "var(--green-soft)" : "var(--amber-soft)",
                    color: c.published ? "var(--green)" : "var(--amber)",
                  }}
                >
                  {c.published ? "Published" : "Draft"}
                </span>
                <div style={{ fontSize: 12, color: c.segmentId ? "var(--ink2)" : "var(--ink3)", marginBottom: 12 }}>
                  {categoryLabel(c)}
                </div>
                <div style={{ display: "flex", gap: 14 }}>
                  <Link href={`/admin/courses/${c.id}`} title="View" style={{ display: "flex" }}>
                    <EyeIcon />
                  </Link>
                  <Link href={`/admin/courses/${c.id}`} title="Edit" style={{ display: "flex" }}>
                    <EditIcon />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
