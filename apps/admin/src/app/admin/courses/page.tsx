"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { coursesApi, segmentsApi, ApiError, type Course, type Segment } from "@/lib/api";
import Modal from "@/components/Modal";

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
      await coursesApi.create({ title });
      setTitle("");
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
            <p style={{ color: "var(--ink3)", fontSize: 12, marginBottom: 16 }}>
              Courses start uncategorized — assign them to a segment or sub-segment from the Segments page.
            </p>
            <button
              type="submit"
              disabled={creating}
              style={{
                width: "100%",
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

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rl)",
          padding: 22,
        }}
      >
        {loading ? (
          <p style={{ color: "var(--ink2)" }}>Loading…</p>
        ) : filteredCourses.length === 0 ? (
          <p style={{ color: "var(--ink2)" }}>No courses match.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink2)", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "8px 6px" }}>Title</th>
                <th style={{ padding: "8px 6px" }}>Status</th>
                <th style={{ padding: "8px 6px" }}>Category</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--line2)" }}>
                  <td style={{ padding: "10px 6px", fontWeight: 700 }}>{c.title}</td>
                  <td style={{ padding: "10px 6px" }}>
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
                  </td>
                  <td style={{ padding: "10px 6px", color: c.segmentId ? "var(--ink)" : "var(--ink3)" }}>
                    {categoryLabel(c)}
                  </td>
                  <td style={{ padding: "10px 6px", textAlign: "right" }}>
                    <span style={{ display: "inline-flex", gap: 10 }}>
                      <Link href={`/admin/courses/${c.id}`} title="View" style={{ display: "flex" }}>
                        <EyeIcon />
                      </Link>
                      <Link href={`/admin/courses/${c.id}`} title="Edit" style={{ display: "flex" }}>
                        <EditIcon />
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
