"use client";

import { useEffect, useMemo, useState } from "react";
import {
  storiesApi,
  segmentsApi,
  coursesApi,
  uploadsApi,
  ApiError,
  type Story,
  type StoryStatus,
  type StoryStat,
  type StoryAnalytics,
  type Segment,
  type Course,
} from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import { useConfirm } from "@/components/ConfirmProvider";

/**
 * Success Stories authoring + moderation. The student-facing design lives in
 * Design System/Student - Stories.dc.html; there is no admin mockup, so this follows the
 * existing admin conventions (Subscriptions / Tests) rather than inventing a new look.
 *
 * There is no transcoding pipeline, so the poster image is uploaded alongside the clip and
 * both are stored as private R2 keys, presigned on read.
 */

/** Clips are 20–25s. Anything much larger means a raw phone export that will stall on data. */
const MAX_VIDEO_MB = 15;

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

const btnStyle: React.CSSProperties = {
  padding: "9px 16px",
  background: "var(--ink)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 };

const STATUS_STYLE: Record<StoryStatus, { bg: string; ink: string }> = {
  DRAFT: { bg: "var(--bg-sunk)", ink: "var(--ink2)" },
  PENDING: { bg: "var(--amber-soft)", ink: "var(--amber-ink)" },
  PUBLISHED: { bg: "var(--green-soft)", ink: "var(--green)" },
  REJECTED: { bg: "var(--red-soft)", ink: "var(--red-ink)" },
  ARCHIVED: { bg: "var(--bg-sunk)", ink: "var(--ink3)" },
};

const EXPIRY_PRESETS = [
  { label: "Evergreen", days: null },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
];

type Tab = "all" | "PENDING";

type FormState = {
  studentName: string;
  resultChip: string;
  quote: string;
  body: string;
  avatarInitials: string;
  verified: boolean;
  videoKey: string;
  posterKey: string;
  durationSeconds: string;
  orientation: "PORTRAIT" | "LANDSCAPE";
  captionsVtt: string;
  stats: StoryStat[];
  ctaLabel: string;
  ctaUrl: string;
  courseId: string;
  allSegments: boolean;
  segmentIds: string[];
  pinned: boolean;
  expiryDays: number | null;
};

const emptyForm = (): FormState => ({
  studentName: "",
  resultChip: "",
  quote: "",
  body: "",
  avatarInitials: "",
  verified: false,
  videoKey: "",
  posterKey: "",
  durationSeconds: "22",
  orientation: "PORTRAIT",
  captionsVtt: "",
  stats: [
    { label: "BEFORE", value: "", unit: "" },
    { label: "AFTER", value: "", unit: "" },
    { label: "TOOK", value: "", unit: "" },
  ],
  ctaLabel: "",
  ctaUrl: "",
  courseId: "",
  allSegments: false,
  segmentIds: [],
  pinned: false,
  expiryDays: null,
});

export default function AdminStoriesPage() {
  const confirm = useConfirm();
  const [stories, setStories] = useState<Story[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");

  const [editing, setEditing] = useState<Story | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"video" | "poster" | null>(null);

  const [analyticsFor, setAnalyticsFor] = useState<Story | null>(null);
  const [analytics, setAnalytics] = useState<StoryAnalytics | null>(null);

  function load() {
    setLoading(true);
    Promise.all([storiesApi.list(), segmentsApi.list(), coursesApi.list()])
      .then(([s, seg, c]) => {
        setStories(s);
        setSegments(seg);
        setCourses(c);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load stories"))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const visible = useMemo(
    () => (tab === "PENDING" ? stories.filter((s) => s.status === "PENDING") : stories),
    [stories, tab],
  );
  const pendingCount = stories.filter((s) => s.status === "PENDING").length;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(s: Story) {
    setEditing(s);
    setForm({
      studentName: s.studentName,
      resultChip: s.resultChip,
      quote: s.quote,
      body: s.body ?? "",
      avatarInitials: s.avatarInitials ?? "",
      verified: s.verified,
      videoKey: s.videoKey,
      posterKey: s.posterKey,
      durationSeconds: String(s.durationSeconds),
      orientation: s.orientation,
      captionsVtt: s.captionsVtt ?? "",
      stats: s.stats.length ? s.stats : emptyForm().stats,
      ctaLabel: s.ctaLabel ?? "",
      ctaUrl: s.ctaUrl ?? "",
      courseId: s.courseId ?? "",
      allSegments: s.allSegments,
      segmentIds: s.segments.map((x) => x.segmentId),
      pinned: s.pinned,
      expiryDays: null,
    });
    setFormError(null);
    setShowForm(true);
  }

  async function pickFile(kind: "video" | "poster") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "video" ? "video/*" : "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (kind === "video" && file.size > MAX_VIDEO_MB * 1024 * 1024) {
        setFormError(`Clip is ${(file.size / 1024 / 1024).toFixed(1)} MB — keep it under ${MAX_VIDEO_MB} MB so it plays on mobile data.`);
        return;
      }
      setUploading(kind);
      setFormError(null);
      try {
        const key = await uploadsApi.uploadFile(file);
        setForm((f) => (kind === "video" ? { ...f, videoKey: key } : { ...f, posterKey: key }));
      } catch (err) {
        setFormError(err instanceof ApiError ? err.message : "Upload failed");
      } finally {
        setUploading(null);
      }
    };
    input.click();
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = {
      studentName: form.studentName,
      resultChip: form.resultChip,
      quote: form.quote,
      body: form.body || undefined,
      avatarInitials: form.avatarInitials || undefined,
      verified: form.verified,
      videoKey: form.videoKey,
      posterKey: form.posterKey,
      durationSeconds: Number(form.durationSeconds) || 0,
      orientation: form.orientation,
      captionsVtt: form.captionsVtt || undefined,
      // Only cells the author actually filled in reach the viewer.
      stats: form.stats.filter((s) => s.label.trim() && s.value.trim()),
      ctaLabel: form.ctaLabel || undefined,
      ctaUrl: form.ctaUrl || undefined,
      courseId: form.courseId || null,
      allSegments: form.allSegments,
      segmentIds: form.segmentIds,
      pinned: form.pinned,
      expiresAt:
        form.expiryDays === null
          ? null
          : new Date(Date.now() + form.expiryDays * 86400000).toISOString(),
    };
    try {
      if (editing) await storiesApi.update(editing.id, payload);
      else await storiesApi.create(payload);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save story");
    } finally {
      setSaving(false);
    }
  }

  async function act(fn: () => Promise<unknown>, failure: string) {
    try {
      await fn();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : failure);
    }
  }

  async function onReject(s: Story) {
    const reason = window.prompt(`Reject "${s.studentName}"? Optional reason for the uploader:`);
    if (reason === null) return;
    await act(() => storiesApi.reject(s.id, reason || undefined), "Failed to reject story");
  }

  async function onDelete(s: Story) {
    if (!(await confirm({ message: `Delete the story from "${s.studentName}"? This cannot be undone.` }))) return;
    await act(() => storiesApi.remove(s.id), "Failed to delete story");
  }

  async function openAnalytics(s: Story) {
    setAnalyticsFor(s);
    setAnalytics(null);
    try {
      setAnalytics(await storiesApi.analytics(s.id));
    } catch {
      setAnalyticsFor(null);
      setError("Failed to load analytics");
    }
  }

  const toggleSegment = (id: string) =>
    setForm((f) => ({
      ...f,
      segmentIds: f.segmentIds.includes(id) ? f.segmentIds.filter((x) => x !== id) : [...f.segmentIds, id],
    }));

  return (
    <main className="fade-in" style={{ padding: "30px 30px 60px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Success Stories</div>
          <p style={{ fontSize: 13, color: "var(--ink3)", marginTop: 4 }}>
            20–25 second testimonial clips shown on the student dashboard, scoped to the segments you tag.
          </p>
        </div>
        <button onClick={openCreate} style={{ ...btnStyle, display: "flex", alignItems: "center", gap: 7 }}>
          + New story
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, background: "var(--bg-sunk)", borderRadius: 11, padding: 4, width: "max-content", marginBottom: 18 }}>
        {([["all", `All (${stories.length})`], ["PENDING", `Moderation (${pendingCount})`]] as [Tab, string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            aria-pressed={tab === v}
            style={{
              fontSize: 12.5, fontWeight: 600, padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: "inherit",
              background: tab === v ? "var(--card)" : "transparent",
              color: tab === v ? "var(--ink)" : "var(--ink2)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 14 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)", fontSize: 13 }}>Loading…</p>
      ) : visible.length === 0 ? (
        <div style={{ maxWidth: 480, padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)" }}>
          {tab === "PENDING" ? "Nothing waiting for review." : "No stories yet — upload the first one."}
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", overflow: "hidden" }}>
          {visible.map((s) => {
            const st = STATUS_STYLE[s.status];
            return (
              <div key={s.id} style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--line2)", flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 46, height: 61, borderRadius: 8, flex: "none",
                    background: s.posterUrl ? `center/cover no-repeat url(${s.posterUrl})` : "linear-gradient(165deg,#3b332e,#1f1a17)",
                  }}
                />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{s.studentName}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, background: "var(--ink)", color: "#fff", borderRadius: 5, padding: "2px 7px" }}>
                      {s.resultChip}
                    </span>
                    {s.verified && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, background: "var(--green-soft)", color: "var(--green)", borderRadius: 5, padding: "2px 6px" }}>✓ VERIFIED</span>
                    )}
                    {s.pinned && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, background: "var(--orange-soft)", color: "var(--orange-deep)", borderRadius: 5, padding: "2px 6px" }}>★ PINNED</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 460 }}>
                    &ldquo;{s.quote}&rdquo;
                  </div>
                  <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                    {s.allSegments ? (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, background: "var(--purple-soft)", color: "var(--purple-ink)", borderRadius: 5, padding: "2px 7px" }}>ALL SEGMENTS</span>
                    ) : (
                      s.segments.map((x) => (
                        <span key={x.segmentId} style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, background: "var(--bg-sunk)", color: "var(--ink2)", borderRadius: 5, padding: "2px 7px" }}>
                          {x.segment.name}
                        </span>
                      ))
                    )}
                    {s.expiresAt && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "var(--ink3)", padding: "2px 4px" }}>
                        expires {new Date(s.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {s.status === "REJECTED" && s.rejectionReason && (
                    <div style={{ fontSize: 11.5, color: "var(--red-ink)", marginTop: 5 }}>Rejected: {s.rejectionReason}</div>
                  )}
                </div>

                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, background: st.bg, color: st.ink, borderRadius: 999, padding: "5px 11px", flex: "none" }}>
                  {s.status}
                </span>
                <div style={{ textAlign: "right", flex: "none", minWidth: 54 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 800, color: "var(--orange-deep)" }}>{s._count?.views ?? 0}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: 1, color: "var(--ink3)" }}>VIEWERS</div>
                </div>

                <div style={{ display: "flex", gap: 6, flex: "none", flexWrap: "wrap" }}>
                  {(s.status === "PENDING" || s.status === "DRAFT") && (
                    <button onClick={() => act(() => storiesApi.approve(s.id), "Failed to approve")} style={{ ...btnStyle, background: "var(--green)", padding: "7px 12px", fontSize: 12 }}>
                      Approve
                    </button>
                  )}
                  {s.status === "PENDING" && (
                    <button onClick={() => onReject(s)} style={{ ...btnStyle, background: "var(--card)", color: "var(--red-ink)", border: "1px solid var(--line)", padding: "7px 12px", fontSize: 12 }}>
                      Reject
                    </button>
                  )}
                  {s.status === "PUBLISHED" && (
                    <button onClick={() => act(() => storiesApi.archive(s.id), "Failed to archive")} style={{ ...btnStyle, background: "var(--card)", color: "var(--ink2)", border: "1px solid var(--line)", padding: "7px 12px", fontSize: 12 }}>
                      Archive
                    </button>
                  )}
                  <button onClick={() => act(() => storiesApi.update(s.id, { pinned: !s.pinned }), "Failed to pin")} title={s.pinned ? "Unpin" : "Pin"} style={{ ...btnStyle, background: "var(--card)", color: s.pinned ? "var(--orange-deep)" : "var(--ink2)", border: "1px solid var(--line)", padding: "7px 10px", fontSize: 12 }}>
                    ★
                  </button>
                  <button onClick={() => openAnalytics(s)} style={{ ...btnStyle, background: "var(--card)", color: "var(--ink2)", border: "1px solid var(--line)", padding: "7px 12px", fontSize: 12 }}>
                    Stats
                  </button>
                  <button onClick={() => openEdit(s)} style={{ ...btnStyle, background: "var(--card)", color: "var(--ink2)", border: "1px solid var(--line)", padding: "7px 12px", fontSize: 12 }}>
                    Edit
                  </button>
                  <button onClick={() => onDelete(s)} style={{ ...btnStyle, background: "var(--card)", color: "var(--red-ink)", border: "1px solid var(--line)", padding: "7px 12px", fontSize: 12 }}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- create / edit ---- */}
      {showForm && (
        <Modal title={editing ? "Edit story" : "New story"} onClose={() => setShowForm(false)}>
          <form onSubmit={onSave} style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Student name *</div>
                <input required value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} style={inputStyle} placeholder="Rhea Sharma" />
              </div>
              <div>
                <div style={labelStyle}>Result *</div>
                <input
                  required
                  value={form.resultChip}
                  onChange={(e) => setForm({ ...form, resultChip: e.target.value })}
                  style={inputStyle}
                  placeholder="AIR 214 · 640/720 · 99.1%ile"
                />
              </div>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--ink3)", margin: "-8px 0 0" }}>
              The result is required — the design has no card without a number on it.
            </p>

            {/* media */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Clip * (max {MAX_VIDEO_MB} MB)</div>
                <button type="button" onClick={() => pickFile("video")} style={{ ...btnStyle, background: "var(--card)", color: "var(--ink2)", border: "1px solid var(--line)", width: "100%" }}>
                  {uploading === "video" ? "Uploading…" : form.videoKey ? "✓ Clip attached — replace" : "Upload clip"}
                </button>
              </div>
              <div>
                <div style={labelStyle}>Poster image *</div>
                <button type="button" onClick={() => pickFile("poster")} style={{ ...btnStyle, background: "var(--card)", color: "var(--ink2)", border: "1px solid var(--line)", width: "100%" }}>
                  {uploading === "poster" ? "Uploading…" : form.posterKey ? "✓ Poster attached — replace" : "Upload poster"}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--ink3)", margin: "-8px 0 0" }}>
              The poster is the rail thumbnail and the fallback on slow connections — it can&apos;t be generated from the video, so it must be uploaded.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Duration (s)</div>
                <input type="number" min={0} value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Orientation</div>
                <select value={form.orientation} onChange={(e) => setForm({ ...form, orientation: e.target.value as "PORTRAIT" | "LANDSCAPE" })} style={inputStyle}>
                  <option value="PORTRAIT">Portrait 9:16</option>
                  <option value="LANDSCAPE">Landscape 16:9 (letterboxed)</option>
                </select>
              </div>
              <div>
                <div style={labelStyle}>Initials</div>
                <input maxLength={3} value={form.avatarInitials} onChange={(e) => setForm({ ...form, avatarInitials: e.target.value.toUpperCase() })} style={inputStyle} placeholder="RS" />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Pull quote *</div>
              <textarea required value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} placeholder="I stopped chasing mock count and fixed one error type a week." />
            </div>
            <div>
              <div style={labelStyle}>Body</div>
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} />
            </div>

            {/* stat cells */}
            <div>
              <div style={labelStyle}>Result stats (up to 3 — shown beside the clip)</div>
              <div style={{ display: "grid", gap: 8 }}>
                {form.stats.map((st, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {(["label", "value", "unit"] as const).map((field) => (
                      <input
                        key={field}
                        value={st[field] ?? ""}
                        placeholder={field}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            stats: f.stats.map((x, j) => (j === i ? { ...x, [field]: e.target.value } : x)),
                          }))
                        }
                        style={inputStyle}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* audience */}
            <div>
              <div style={labelStyle}>Who sees this story? *</div>
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
                <input type="checkbox" checked={form.allSegments} onChange={(e) => setForm({ ...form, allSegments: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--orange)" }} />
                All segments (LMS-wide)
              </label>
              {!form.allSegments && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {segments.map((seg) => {
                    const on = form.segmentIds.includes(seg.id);
                    return (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => toggleSegment(seg.id)}
                        style={{
                          fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                          border: `1.5px solid ${on ? "var(--orange)" : "var(--line)"}`,
                          background: on ? "var(--orange-soft)" : "var(--card)",
                          color: on ? "var(--orange-deep)" : "var(--ink2)",
                        }}
                      >
                        {seg.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Course in this story</div>
                <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} style={inputStyle}>
                  <option value="">None</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={labelStyle}>Visible for</div>
                <select value={String(form.expiryDays)} onChange={(e) => setForm({ ...form, expiryDays: e.target.value === "null" ? null : Number(e.target.value) })} style={inputStyle}>
                  {EXPIRY_PRESETS.map((p) => (
                    <option key={p.label} value={String(p.days)}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>CTA label</div>
                <input value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} style={inputStyle} placeholder="Enroll in this course →" />
              </div>
              <div>
                <div style={labelStyle}>CTA link</div>
                <input value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} style={inputStyle} placeholder="/student/courses/…" />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Captions (WebVTT)</div>
              <textarea value={form.captionsVtt} onChange={(e) => setForm({ ...form, captionsVtt: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12 }} placeholder={"WEBVTT\n\n00:00.000 --> 00:04.000\nFirst line of the transcript"} />
              <p style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 4 }}>
                Captions are not generated automatically — paste a VTT track if you have one.
              </p>
            </div>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--orange)" }} />
                Verified result
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--orange)" }} />
                Pin to the front of the rail
              </label>
            </div>

            {formError && <span style={{ color: "var(--red)", fontSize: 12.5 }}>{formError}</span>}

            <button
              type="submit"
              disabled={saving || !!uploading || !form.videoKey || !form.posterKey}
              style={{ ...btnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: saving || !form.videoKey || !form.posterKey ? 0.6 : 1 }}
            >
              {saving && <Spinner />}
              {saving ? "Saving…" : editing ? "Save story" : "Create as draft"}
            </button>
            {(!form.videoKey || !form.posterKey) && (
              <span style={{ fontSize: 11.5, color: "var(--ink3)", textAlign: "center" }}>A clip and a poster image are both required.</span>
            )}
          </form>
        </Modal>
      )}

      {/* ---- analytics ---- */}
      {analyticsFor && (
        <Modal title={`Analytics — ${analyticsFor.studentName}`} onClose={() => setAnalyticsFor(null)}>
          {!analytics ? (
            <p style={{ color: "var(--ink2)", fontSize: 13 }}>Loading…</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "TOTAL VIEWS", value: analytics.totalViews },
                  { label: "UNIQUE VIEWERS", value: analytics.uniqueViewers },
                  { label: "AVG WATCH", value: `${analytics.avgWatchSeconds}s` },
                  { label: "COMPLETION", value: `${analytics.completionRate}%` },
                ].map((c) => (
                  <div key={c.label} style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 13, padding: "12px 14px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: 1.1, color: "var(--ink3)" }}>{c.label}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 21, fontWeight: 800, marginTop: 4 }}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink2)", marginBottom: 6 }}>
                  <span>Watched through</span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>
                    {analytics.completions} of {analytics.uniqueViewers}
                  </span>
                </div>
                <div style={{ height: 8, background: "var(--line2)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${analytics.completionRate}%`, height: "100%", background: "var(--progress)" }} />
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>
                🔥 {analytics.reactionCount} inspired · clip runs {analytics.durationSeconds}s
              </div>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}
