"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { coursesApi, segmentsApi, uploadsApi, ApiError, type Course, type Segment, type CourseType, type DripType, type CompletionRule } from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import { useImageLightbox } from "@/components/ImageLightboxProvider";

const BANNER_HEIGHT = 110;

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function CardBanner({ url, name }: { url: string | null; name: string }) {
  const openImage = useImageLightbox();
  if (url) {
    return (
      <div
        onClick={() => openImage(url, name)}
        style={{ position: "relative", height: BANNER_HEIGHT, background: `url(${url}) center/cover`, cursor: "pointer" }}
      >
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
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(242,106,27,.35), transparent 70%)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          className="banner-gradient-orange"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {initials(name)}
        </div>
      </div>
    </div>
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
  const [newType, setNewType] = useState<CourseType>("FREE");
  const [newDripType, setNewDripType] = useState<DripType>("NONE");
  const [newPublished, setNewPublished] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit-in-modal state
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eDescription, setEDescription] = useState("");
  const [eBannerFile, setEBannerFile] = useState<File | null>(null);
  const [eType, setEType] = useState<CourseType>("FREE");
  const [ePrice, setEPrice] = useState(""); // rupees, string for input
  const [eDurationHours, setEDurationHours] = useState("");
  const [eDripType, setEDripType] = useState<DripType>("NONE");
  const [eCompletionRule, setECompletionRule] = useState<CompletionRule>("MANUAL");
  const [ePublished, setEPublished] = useState(false);
  const [saving, setSaving] = useState(false);

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

  function openAdd() {
    setTitle("");
    setBannerFile(null);
    setNewType("FREE");
    setNewDripType("NONE");
    setNewPublished(false);
    setShowAddModal(true);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const thumbnailUrl = bannerFile ? await uploadsApi.uploadFile(bannerFile) : undefined;
      await coursesApi.create({ title, thumbnailUrl, type: newType, dripType: newDripType, published: newPublished });
      setShowAddModal(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create course");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(c: Course) {
    setError(null);
    setEditCourse(c);
    setETitle(c.title);
    setEDescription(c.description ?? "");
    setEBannerFile(null);
    setEType(c.type);
    setEPrice(c.priceCents != null ? String(Math.round(c.priceCents / 100)) : "");
    setEDurationHours(c.durationMinutes != null ? String(c.durationMinutes / 60) : "");
    setEDripType(c.dripType);
    setECompletionRule(c.completionRule);
    setEPublished(c.published);
  }

  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editCourse) return;
    setError(null);
    setSaving(true);
    try {
      const thumbnailUrl = eBannerFile ? await uploadsApi.uploadFile(eBannerFile) : undefined;
      const priceCents = eType === "PAID" && ePrice.trim() ? Math.round(Number(ePrice) * 100) : null;
      const durationMinutes = eDurationHours.trim() ? Math.round(Number(eDurationHours) * 60) : null;
      await coursesApi.update(editCourse.id, {
        title: eTitle,
        description: eDescription,
        type: eType,
        priceCents,
        durationMinutes,
        dripType: eDripType,
        completionRule: eCompletionRule,
        published: ePublished,
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
      });
      setEditCourse(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save course");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Courses</div>
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

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Type</div>
              <select value={newType} onChange={(e) => setNewType(e.target.value as CourseType)} style={{ ...inputStyle, width: "100%" }}>
                <option value="FREE">Free</option>
                <option value="PAID">Paid</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Dripping</div>
              <select value={newDripType} onChange={(e) => setNewDripType(e.target.value as DripType)} style={{ ...inputStyle, width: "100%" }}>
                <option value="NONE">Off — all chapters open</option>
                <option value="CALENDAR">Calendar — unlock on a fixed date</option>
                <option value="ENROLLMENT_RELATIVE">Enrollment-relative — unlock N days after joining</option>
              </select>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13, fontWeight: 700, color: "var(--ink2)", cursor: "pointer" }}>
              <input type="checkbox" checked={newPublished} onChange={(e) => setNewPublished(e.target.checked)} />
              Publish immediately
            </label>

            <p style={{ color: "var(--ink3)", fontSize: 12, marginBottom: 16 }}>
              Courses start uncategorized — assign them to a segment or sub-segment from the Segments page. All of this can be changed later from the course page.
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

      {editCourse && (
        <Modal title="Edit course" onClose={() => setEditCourse(null)} maxWidth={520}>
          <form onSubmit={onUpdate}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Course name</div>
            <input
              required
              autoFocus
              placeholder="Course name"
              value={eTitle}
              onChange={(e) => setETitle(e.target.value)}
              style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
            />

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Description</div>
            <textarea
              placeholder="Short description shown on the catalog"
              value={eDescription}
              onChange={(e) => setEDescription(e.target.value)}
              rows={3}
              style={{ ...inputStyle, width: "100%", marginBottom: 12, resize: "vertical", lineHeight: 1.5 }}
            />

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Banner image</div>
            {editCourse.thumbnailUrl && !eBannerFile && (
              <div style={{ height: 90, borderRadius: 10, marginBottom: 8, background: `url(${editCourse.thumbnailUrl}) center/cover` }} />
            )}
            <input type="file" accept="image/*" onChange={(e) => setEBannerFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13, marginBottom: 12 }} />

            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Type</div>
                <select value={eType} onChange={(e) => setEType(e.target.value as CourseType)} style={{ ...inputStyle, width: "100%" }}>
                  <option value="FREE">Free</option>
                  <option value="PAID">Paid</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </div>
              {eType === "PAID" && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Price (₹)</div>
                  <input type="number" min={0} value={ePrice} onChange={(e) => setEPrice(e.target.value)} placeholder="0" style={{ ...inputStyle, width: "100%" }} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Duration (hrs)</div>
                <input type="number" min={0} step="0.5" value={eDurationHours} onChange={(e) => setEDurationHours(e.target.value)} placeholder="—" style={{ ...inputStyle, width: "100%" }} />
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Dripping</div>
            <select value={eDripType} onChange={(e) => setEDripType(e.target.value as DripType)} style={{ ...inputStyle, width: "100%", marginBottom: eDripType === "SEQUENTIAL" ? 12 : 0 }}>
              <option value="NONE">Off — all chapters open</option>
              <option value="CALENDAR">Calendar — unlock on a fixed date</option>
              <option value="ENROLLMENT_RELATIVE">Enrollment-relative — unlock N days after joining</option>
              <option value="SEQUENTIAL">Sequential — unlock next chapter when previous is finished</option>
            </select>
            {eDripType === "SEQUENTIAL" && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", margin: "12px 0 6px" }}>A chapter counts as finished when</div>
                <select value={eCompletionRule} onChange={(e) => setECompletionRule(e.target.value as CompletionRule)} style={{ ...inputStyle, width: "100%" }}>
                  <option value="MANUAL">Student marks it done</option>
                  <option value="ALL_LESSONS_VIEWED">Student opens every lesson</option>
                  <option value="PASS_TEST">Student passes the chapter&apos;s test</option>
                </select>
              </>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0", fontSize: 13, fontWeight: 700, color: "var(--ink2)", cursor: "pointer" }}>
              <input type="checkbox" checked={ePublished} onChange={(e) => setEPublished(e.target.checked)} />
              Published
            </label>

            <p style={{ color: "var(--ink3)", fontSize: 12, marginBottom: 16 }}>
              Segment/sub-segment assignment and chapters are managed from the course page (View).
            </p>
            <button
              type="submit"
              disabled={saving}
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
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving && <Spinner />}
              {saving ? "Saving…" : "Save changes"}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
          {filteredCourses.map((c) => (
            <div
              key={c.id}
              className="entity-card"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rl)",
                overflow: "hidden",
              }}
            >
              <CardBanner url={c.thumbnailUrl} name={c.title} />
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
                  <Link href={`/admin/courses/${c.id}`} title="View / build" style={{ display: "flex" }}>
                    <EyeIcon />
                  </Link>
                  <button
                    onClick={() => openEdit(c)}
                    title="Edit"
                    style={{ display: "flex", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  >
                    <EditIcon />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
