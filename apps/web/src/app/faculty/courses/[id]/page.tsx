"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { coursesApi, uploadsApi, segmentsApi, messengerApi, ApiError, type CourseTree, type Segment, type CourseType, type DripType, type CoursePrivateAccess } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";
import { useImageLightbox } from "@/components/ImageLightboxProvider";

type StudentContact = { id: string; fullName: string; email: string; role: "STUDENT" | "FACULTY" | "ADMIN" };

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
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

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.8">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  );
}

export default function CourseAuthoringPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const confirm = useConfirm();
  const openImage = useImageLightbox();

  const [course, setCourse] = useState<CourseTree | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterBanner, setNewChapterBanner] = useState<File | null>(null);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState("");
  const [editChapterBanner, setEditChapterBanner] = useState<File | null>(null);
  const [editUnlockAt, setEditUnlockAt] = useState("");
  const [editUnlockAfterDays, setEditUnlockAfterDays] = useState("");
  const [savingChapter, setSavingChapter] = useState(false);

  const [privateAccess, setPrivateAccess] = useState<CoursePrivateAccess[]>([]);
  const [students, setStudents] = useState<StudentContact[]>([]);
  const [grantStudentId, setGrantStudentId] = useState("");
  const [grantingAccess, setGrantingAccess] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([coursesApi.get(courseId), segmentsApi.list()])
      .then(([c, s]) => {
        setCourse(c);
        setSegments(s);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load course"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [courseId]);

  useEffect(() => {
    messengerApi.listContacts().then((all) => setStudents(all.filter((u) => u.role === "STUDENT"))).catch(() => {});
  }, []);

  function loadPrivateAccess() {
    coursesApi.listPrivateAccess(courseId).then(setPrivateAccess).catch(() => {});
  }

  useEffect(() => {
    if (course?.type === "PRIVATE") loadPrivateAccess();
  }, [course?.type, courseId]);

  async function onTogglePublished() {
    if (!course) return;
    const updated = await coursesApi.update(course.id, { published: !course.published });
    setCourse({ ...course, published: updated.published });
  }

  async function onChangeType(type: CourseType) {
    if (!course) return;
    const updated = await coursesApi.update(course.id, { type });
    setCourse({ ...course, type: updated.type });
  }

  async function onChangeDripType(dripType: DripType) {
    if (!course) return;
    const updated = await coursesApi.update(course.id, { dripType });
    setCourse({ ...course, dripType: updated.dripType });
  }

  async function onGrantAccess() {
    if (!grantStudentId) return;
    setGrantingAccess(true);
    try {
      await coursesApi.grantPrivateAccess(courseId, grantStudentId);
      setGrantStudentId("");
      loadPrivateAccess();
    } finally {
      setGrantingAccess(false);
    }
  }

  async function onRevokeAccess(studentId: string) {
    if (!(await confirm({ message: "Revoke this student's access to the course?" }))) return;
    await coursesApi.revokePrivateAccess(courseId, studentId);
    loadPrivateAccess();
  }

  async function onAddChapter(e: React.FormEvent) {
    e.preventDefault();
    if (!newChapterTitle.trim()) return;
    const bannerUrl = newChapterBanner ? await uploadsApi.uploadFile(newChapterBanner) : undefined;
    await coursesApi.createChapter(courseId, { title: newChapterTitle, bannerUrl });
    setNewChapterTitle("");
    setNewChapterBanner(null);
    load();
  }

  async function onDeleteChapter(id: string) {
    if (!(await confirm({ message: "Delete this chapter and all its lessons? This cannot be undone." }))) return;
    await coursesApi.removeChapter(id);
    load();
  }

  function openEditChapter(id: string, title: string, unlockAt: string | null, unlockAfterDays: number | null) {
    setEditingChapterId(id);
    setEditChapterTitle(title);
    setEditChapterBanner(null);
    setEditUnlockAt(unlockAt ? unlockAt.slice(0, 16) : "");
    setEditUnlockAfterDays(unlockAfterDays != null ? String(unlockAfterDays) : "");
  }

  async function onSaveChapterEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingChapterId) return;
    setSavingChapter(true);
    try {
      const bannerUrl = editChapterBanner ? await uploadsApi.uploadFile(editChapterBanner) : undefined;
      await coursesApi.updateChapter(editingChapterId, {
        title: editChapterTitle,
        bannerUrl,
        unlockAt: editUnlockAt ? new Date(editUnlockAt).toISOString() : null,
        unlockAfterDays: editUnlockAfterDays ? Number(editUnlockAfterDays) : null,
      });
      setEditingChapterId(null);
      load();
    } finally {
      setSavingChapter(false);
    }
  }

  if (loading) return <main style={{ padding: 40 }}><p style={{ color: "var(--ink2)" }}>Loading…</p></main>;
  if (error || !course) return <main style={{ padding: 40 }}><p style={{ color: "var(--red)" }}>{error ?? "Course not found"}</p></main>;

  return (
    <main className="fade-in" style={{ padding: "30px 40px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--orange)", textTransform: "uppercase", marginBottom: 4 }}>
            Course
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>{course.title}</h1>
          {course.description && <p style={{ color: "var(--ink2)", marginTop: 6 }}>{course.description}</p>}
        </div>
        <span style={{ display: "flex", gap: 10 }}>
          <Link href={`/faculty/courses/${courseId}/mock-tests`} style={{ ...btnStyle, background: "var(--purple-soft)", color: "var(--purple)", display: "flex", alignItems: "center" }}>
            Mock Tests
          </Link>
          <button
            onClick={onTogglePublished}
            style={{
              ...btnStyle,
              background: course.published ? "var(--amber-soft)" : "var(--green-soft)",
              color: course.published ? "var(--amber)" : "var(--green)",
            }}
          >
            {course.published ? "Unpublish" : "Publish"}
          </button>
        </span>
      </div>

      {(() => {
        const courseSegment = segments.find((s) => s.id === course.segmentId);
        const courseSubsegment = courseSegment?.subsegments.find((sub) => sub.id === course.subsegmentId);
        const categoryLabel = courseSegment ? (courseSubsegment ? `${courseSegment.name} / ${courseSubsegment.name}` : courseSegment.name) : "Uncategorized";
        return (
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 20,
              padding: "12px 16px",
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--rm)",
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 700, color: "var(--ink2)" }}>Category:</span>
            <span style={{ color: courseSegment ? "var(--ink)" : "var(--ink3)" }}>{categoryLabel}</span>
          </div>
        );
      })()}

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 10,
          padding: "12px 16px",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rm)",
          alignItems: "center",
          fontSize: 13,
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--ink2)" }}>Type:</span>
        <select value={course.type} onChange={(e) => onChangeType(e.target.value as CourseType)} style={{ ...inputStyle, width: 160 }}>
          <option value="FREE">Free</option>
          <option value="PAID">Paid</option>
          <option value="PRIVATE">Private</option>
        </select>
        <span style={{ color: "var(--ink3)" }}>
          {course.type === "FREE" && "Students in this segment can self-enroll."}
          {course.type === "PAID" && "Requires admin enrollment or a subscription — no self-enroll."}
          {course.type === "PRIVATE" && "Only whitelisted students below can access this course."}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 10,
          padding: "12px 16px",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rm)",
          alignItems: "center",
          fontSize: 13,
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--ink2)" }}>Dripping:</span>
        <select value={course.dripType} onChange={(e) => onChangeDripType(e.target.value as DripType)} style={{ ...inputStyle, width: 220 }}>
          <option value="NONE">Off — all chapters open</option>
          <option value="CALENDAR">Calendar — unlock on a fixed date</option>
          <option value="ENROLLMENT_RELATIVE">Enrollment-relative — unlock N days after joining</option>
        </select>
        <span style={{ color: "var(--ink3)" }}>Set per-chapter unlock timing by editing each chapter below.</span>
      </div>

      {course.type === "PRIVATE" && (
        <div style={{ marginTop: 14, padding: "16px 18px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 10 }}>Private access</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <select value={grantStudentId} onChange={(e) => setGrantStudentId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">Select a student to grant access…</option>
              {students
                .filter((s) => !privateAccess.some((a) => a.studentId === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.email})
                  </option>
                ))}
            </select>
            <button onClick={onGrantAccess} disabled={!grantStudentId || grantingAccess} style={{ ...btnStyle, opacity: !grantStudentId || grantingAccess ? 0.7 : 1 }}>
              {grantingAccess ? "Granting…" : "Grant access"}
            </button>
          </div>
          {privateAccess.length === 0 ? (
            <p style={{ color: "var(--ink3)", fontSize: 13 }}>No students have been granted access yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {privateAccess.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, fontSize: 13 }}>
                  <span>
                    <b>{a.student.fullName}</b> <span style={{ color: "var(--ink3)" }}>{a.student.email}</span>
                  </span>
                  <button onClick={() => onRevokeAccess(a.studentId)} style={{ background: "none", border: "none", color: "var(--red)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={onAddChapter} style={{ display: "flex", gap: 10, marginTop: 28, marginBottom: 20 }}>
        <input
          placeholder="New chapter title"
          value={newChapterTitle}
          onChange={(e) => setNewChapterTitle(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setNewChapterBanner(e.target.files?.[0] ?? null)}
          style={{ fontSize: 13, alignSelf: "center" }}
          title="Banner image (optional)"
        />
        <button type="submit" style={btnStyle}>Add chapter</button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 18 }}>
        {course.chapters.map((chapter) => {
          const editing = editingChapterId === chapter.id;
          return (
            <div key={chapter.id} className="entity-card" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: 20, overflow: "hidden" }}>
              {chapter.bannerUrl ? (
                <div
                  onClick={() => openImage(chapter.bannerUrl!, chapter.title)}
                  style={{ position: "relative", height: 100, margin: "-20px -20px 16px", background: `url(${chapter.bannerUrl}) center/cover`, cursor: "pointer" }}
                >
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,.45))" }} />
                </div>
              ) : (
                <div className="banner-gradient-dark" style={{ position: "relative", height: 100, margin: "-20px -20px 16px", overflow: "hidden" }}>
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
                      style={{ width: 40, height: 40, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}
                    >
                      {chapter.title.trim().slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                </div>
              )}

              {editing ? (
                <form onSubmit={onSaveChapterEdit} style={{ display: "grid", gap: 10 }}>
                  <input
                    required
                    autoFocus
                    value={editChapterTitle}
                    onChange={(e) => setEditChapterTitle(e.target.value)}
                    style={inputStyle}
                  />
                  <input type="file" accept="image/*" onChange={(e) => setEditChapterBanner(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
                  {course.dripType === "CALENDAR" && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Unlock date (blank = always open)</div>
                      <input type="datetime-local" value={editUnlockAt} onChange={(e) => setEditUnlockAt(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
                    </div>
                  )}
                  {course.dripType === "ENROLLMENT_RELATIVE" && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)", marginBottom: 6 }}>Unlock N days after enrolling (blank = always open)</div>
                      <input type="number" min={0} value={editUnlockAfterDays} onChange={(e) => setEditUnlockAfterDays(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" disabled={savingChapter} style={{ ...btnStyle, opacity: savingChapter ? 0.7 : 1 }}>
                      {savingChapter ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingChapterId(null)}
                      style={{ background: "none", border: "none", color: "var(--ink3)", fontSize: 13, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>{chapter.title}</h2>
                    <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <Link href={`/faculty/courses/${courseId}/chapters/${chapter.id}`} title="View chapter" style={{ display: "flex" }}>
                        <EyeIcon />
                      </Link>
                      <button
                        onClick={() => openEditChapter(chapter.id, chapter.title, chapter.unlockAt, chapter.unlockAfterDays)}
                        title="Edit chapter"
                        style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => onDeleteChapter(chapter.id)}
                        title="Delete chapter"
                        style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        <TrashIcon />
                      </button>
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4 }}>
                    {chapter.lessons.length} lesson{chapter.lessons.length === 1 ? "" : "s"}
                  </div>
                  {course.dripType === "CALENDAR" && chapter.unlockAt && (
                    <div style={{ fontSize: 12, color: "var(--orange)", marginTop: 4 }}>Unlocks {new Date(chapter.unlockAt).toLocaleString()}</div>
                  )}
                  {course.dripType === "ENROLLMENT_RELATIVE" && chapter.unlockAfterDays != null && (
                    <div style={{ fontSize: 12, color: "var(--orange)", marginTop: 4 }}>
                      Unlocks {chapter.unlockAfterDays} day{chapter.unlockAfterDays === 1 ? "" : "s"} after enrolling
                    </div>
                  )}
                </>
              )}

            </div>
          );
        })}
      </div>
    </main>
  );
}
