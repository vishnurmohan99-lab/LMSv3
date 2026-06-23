"use client";

import { useEffect, useMemo, useState } from "react";
import {
  forumApi,
  usersApi,
  batchesApi,
  coursesApi,
  ApiError,
  type ForumCategory,
  type ForumCategoryAdmin,
  type ForumCategoryInput,
  type ForumScopeType,
  type ForumAccessMode,
  type ForumThread,
  type ForumThreadDetail,
  type Profile,
  type Batch,
  type Course,
} from "@/lib/api";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
import { useConfirm } from "@/components/ConfirmProvider";

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 13.5,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--card)",
  width: "100%",
};

const smallBtn: React.CSSProperties = {
  padding: "8px 14px",
  background: "var(--ink)",
  color: "#fff",
  border: "none",
  borderRadius: 9,
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
};

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

const MODE_OPTIONS: { value: ForumAccessMode; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SELECTED", label: "Selected" },
  { value: "NONE", label: "None" },
];

function UserMultiPicker({
  candidates,
  selectedIds,
  onChange,
}: {
  candidates: Profile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const selected = candidates.filter((c) => selectedIds.includes(c.id));
  const matches = candidates
    .filter((c) => !selectedIds.includes(c.id))
    .filter((c) => c.fullName.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 6);

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, background: "var(--bg)" }}>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {selected.map((u) => (
            <span
              key={u.id}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "var(--orange-soft)", color: "var(--orange)", borderRadius: 7, fontSize: 12, fontWeight: 700 }}
            >
              {u.fullName}
              <button
                onClick={() => onChange(selectedIds.filter((id) => id !== u.id))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--orange)", fontWeight: 700, padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        style={{ ...inputStyle, marginBottom: search ? 6 : 0 }}
      />
      {search && (
        <div style={{ display: "grid", gap: 3, maxHeight: 140, overflowY: "auto" }}>
          {matches.length === 0 ? (
            <p style={{ color: "var(--ink3)", fontSize: 12 }}>No matches.</p>
          ) : (
            matches.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  onChange([...selectedIds, u.id]);
                  setSearch("");
                }}
                style={{ display: "flex", justifyContent: "space-between", padding: "7px 9px", background: "var(--card)", border: "none", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}
              >
                <span>{u.fullName}</span>
                <span style={{ color: "var(--ink3)" }}>{u.email}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ModeRow({
  label,
  facultyMode,
  studentMode,
  onFacultyMode,
  onStudentMode,
  facultyUserIds,
  studentUserIds,
  onFacultyUserIds,
  onStudentUserIds,
  faculty,
  students,
}: {
  label: string;
  facultyMode: ForumAccessMode;
  studentMode: ForumAccessMode;
  onFacultyMode: (m: ForumAccessMode) => void;
  onStudentMode: (m: ForumAccessMode) => void;
  facultyUserIds: string[];
  studentUserIds: string[];
  onFacultyUserIds: (ids: string[]) => void;
  onStudentUserIds: (ids: string[]) => void;
  faculty: Profile[];
  students: Profile[];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink3)" }}>Faculty</label>
          <select value={facultyMode} onChange={(e) => onFacultyMode(e.target.value as ForumAccessMode)} style={{ ...inputStyle, marginTop: 4 }}>
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {facultyMode === "SELECTED" && (
            <div style={{ marginTop: 6 }}>
              <UserMultiPicker candidates={faculty} selectedIds={facultyUserIds} onChange={onFacultyUserIds} />
            </div>
          )}
        </div>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink3)" }}>Learners</label>
          <select value={studentMode} onChange={(e) => onStudentMode(e.target.value as ForumAccessMode)} style={{ ...inputStyle, marginTop: 4 }}>
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {studentMode === "SELECTED" && (
            <div style={{ marginTop: 6 }}>
              <UserMultiPicker candidates={students} selectedIds={studentUserIds} onChange={onStudentUserIds} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminForumPage() {
  const confirm = useConfirm();

  const [categoriesAdmin, setCategoriesAdmin] = useState<ForumCategoryAdmin[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<ForumThreadDetail | null>(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ForumCategoryAdmin | null>(null);
  const [form, setForm] = useState<ForumCategoryInput>({ name: "", scopeType: "GENERAL" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const faculty = useMemo(() => allUsers.filter((u) => u.role === "FACULTY"), [allUsers]);
  const students = useMemo(() => allUsers.filter((u) => u.role === "STUDENT"), [allUsers]);

  function loadCategoriesAdmin() {
    setLoadingCategories(true);
    forumApi
      .listCategoriesAdmin()
      .then(setCategoriesAdmin)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load categories"))
      .finally(() => setLoadingCategories(false));
  }

  function loadCategories() {
    forumApi.listCategories().then(setCategories).catch(() => {});
  }

  function loadThreads() {
    setLoading(true);
    forumApi
      .listThreads({ categoryId: activeCategory })
      .then(setThreads)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load threads"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCategoriesAdmin();
    loadCategories();
    usersApi.list().then(setAllUsers).catch(() => {});
    batchesApi.listAll().then(setBatches).catch(() => {});
    coursesApi.list().then(setCourses).catch(() => {});
  }, []);
  useEffect(loadThreads, [activeCategory]);

  function openThreadView(id: string) {
    setOpenThreadId(id);
    setError(null);
    forumApi
      .getThread(id)
      .then(setOpenThread)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load thread"));
  }

  function backToList() {
    setOpenThreadId(null);
    setOpenThread(null);
    loadThreads();
    loadCategories();
  }

  async function onTogglePin() {
    if (!openThread) return;
    try {
      await forumApi.updateThread(openThread.id, { pinned: !openThread.pinned });
      setOpenThread(await forumApi.getThread(openThread.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update thread");
    }
  }

  async function onToggleLock() {
    if (!openThread) return;
    try {
      await forumApi.updateThread(openThread.id, { locked: !openThread.locked });
      setOpenThread(await forumApi.getThread(openThread.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update thread");
    }
  }

  function openAddCategory() {
    setEditingCategory(null);
    setForm({
      name: "",
      scopeType: "GENERAL",
      audienceFacultyMode: "ALL",
      audienceStudentMode: "ALL",
      postFacultyMode: "ALL",
      postStudentMode: "ALL",
      commentFacultyMode: "ALL",
      commentStudentMode: "ALL",
      audienceUserIds: [],
      postUserIds: [],
      commentUserIds: [],
    });
    setSaveError(null);
    setShowCategoryModal(true);
  }

  function openEditCategory(c: ForumCategoryAdmin) {
    setEditingCategory(c);
    setForm({
      name: c.name,
      scopeType: c.scopeType,
      batchId: c.batchId ?? undefined,
      courseId: c.courseId ?? undefined,
      audienceFacultyMode: c.audienceFacultyMode,
      audienceStudentMode: c.audienceStudentMode,
      postFacultyMode: c.postFacultyMode,
      postStudentMode: c.postStudentMode,
      commentFacultyMode: c.commentFacultyMode,
      commentStudentMode: c.commentStudentMode,
      audienceUserIds: c.audienceUsers.map((u) => u.id),
      postUserIds: c.postUsers.map((u) => u.id),
      commentUserIds: c.commentUsers.map((u) => u.id),
    });
    setSaveError(null);
    setShowCategoryModal(true);
  }

  async function onSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      if (editingCategory) {
        await forumApi.updateCategory(editingCategory.id, form);
      } else {
        await forumApi.createCategory(form);
      }
      setShowCategoryModal(false);
      loadCategoriesAdmin();
      loadCategories();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteCategory(c: ForumCategoryAdmin) {
    if (!(await confirm({ message: `Delete "${c.name}"? Its ${c.threadCount} thread(s) will be deleted too.` }))) return;
    await forumApi.removeCategory(c.id);
    loadCategoriesAdmin();
    loadCategories();
    if (activeCategory === c.id) setActiveCategory("all");
  }

  const canSaveCategory =
    form.name.trim().length > 0 && (form.scopeType !== "BATCH" || !!form.batchId) && (form.scopeType !== "COURSE" || !!form.courseId);

  return (
    <div style={{ display: "flex", minHeight: "100%" }}>
      <aside style={{ width: 240, flex: "none", borderRight: "1px solid var(--line)", background: "var(--card)", padding: "18px 12px", overflowY: "auto" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: 1, padding: "0 6px 10px" }}>Categories</div>
        <div style={{ display: "grid", gap: 3 }}>
          {[{ id: "all", name: "All Topics", count: categories.reduce((s, c) => s + c.count, 0) }, ...categories].map((c) => {
            const active = activeCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCategory(c.id);
                  setOpenThreadId(null);
                  setOpenThread(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "11px 14px",
                  border: "none",
                  borderRadius: 11,
                  background: active ? "var(--ink)" : "transparent",
                  color: active ? "#fff" : "var(--ink2)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  width: "100%",
                  fontSize: 13.5,
                  fontWeight: active ? 700 : 600,
                  textAlign: "left",
                }}
              >
                <span>{c.name}</span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>{c.count}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "24px 30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3, marginBottom: 4 }}>Forum</div>
            <p style={{ fontSize: 13, color: "var(--ink3)" }}>Manage categories, scope, and posting permissions; pin or lock threads.</p>
          </div>
          <button onClick={openAddCategory} style={smallBtn}>
            + Add category
          </button>
        </div>

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

        <section style={{ marginBottom: 26 }}>
          {loadingCategories ? (
            <p style={{ color: "var(--ink2)" }}>Loading categories…</p>
          ) : categoriesAdmin.length === 0 ? (
            <p style={{ color: "var(--ink3)", fontSize: 13.5 }}>No categories yet — add one above.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {categoriesAdmin.map((c) => (
                <div key={c.id} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--orange)", background: "var(--orange-soft)", padding: "2px 8px", borderRadius: 6 }}>
                      {c.scopeType}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>
                    {c.scopeType === "BATCH" && (c.batch?.name ?? "—")}
                    {c.scopeType === "COURSE" && (c.course?.title ?? "—")}
                    {c.scopeType === "GENERAL" && `Audience: ${c.audienceFacultyMode === "ALL" ? "all faculty" : c.audienceFacultyMode === "NONE" ? "no faculty" : `${c.audienceUsers.filter(u=>u.role==="FACULTY").length} faculty`} + ${c.audienceStudentMode === "ALL" ? "all learners" : c.audienceStudentMode === "NONE" ? "no learners" : `${c.audienceUsers.filter(u=>u.role==="STUDENT").length} learners`}`}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4 }}>{c.threadCount} threads</div>
                  <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
                    <button onClick={() => openEditCategory(c)} style={{ background: "none", border: "none", color: "var(--orange)", fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0 }}>
                      Edit
                    </button>
                    <button onClick={() => onDeleteCategory(c)} style={{ background: "none", border: "none", color: "var(--red)", fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0 }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {showCategoryModal && (
          <Modal title={editingCategory ? "Edit category" : "Add category"} onClose={() => setShowCategoryModal(false)}>
            <form onSubmit={onSaveCategory} style={{ display: "grid", gap: 14, maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
              <input
                required
                autoFocus
                placeholder="Category name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
              />

              {!editingCategory && (
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>Scope</label>
                  <select
                    value={form.scopeType}
                    onChange={(e) => setForm({ ...form, scopeType: e.target.value as ForumScopeType, batchId: undefined, courseId: undefined })}
                    style={{ ...inputStyle, marginTop: 6 }}
                  >
                    <option value="GENERAL">General topic</option>
                    <option value="BATCH">Batch</option>
                    <option value="COURSE">Course</option>
                  </select>
                </div>
              )}

              {form.scopeType === "BATCH" && !editingCategory && (
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>Batch</label>
                  <select value={form.batchId ?? ""} onChange={(e) => setForm({ ...form, batchId: e.target.value })} style={{ ...inputStyle, marginTop: 6 }}>
                    <option value="">Select a batch…</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 6 }}>Visible to everyone enrolled in this batch, plus all faculty.</p>
                </div>
              )}

              {form.scopeType === "COURSE" && !editingCategory && (
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>Course</label>
                  <select value={form.courseId ?? ""} onChange={(e) => setForm({ ...form, courseId: e.target.value })} style={{ ...inputStyle, marginTop: 6 }}>
                    <option value="">Select a course…</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 6 }}>Visible to everyone enrolled in this course, plus all faculty.</p>
                </div>
              )}

              {form.scopeType === "GENERAL" && (
                <ModeRow
                  label="Who can see this category"
                  facultyMode={form.audienceFacultyMode ?? "ALL"}
                  studentMode={form.audienceStudentMode ?? "ALL"}
                  onFacultyMode={(m) => setForm({ ...form, audienceFacultyMode: m })}
                  onStudentMode={(m) => setForm({ ...form, audienceStudentMode: m })}
                  facultyUserIds={(form.audienceUserIds ?? []).filter((id) => faculty.some((f) => f.id === id))}
                  studentUserIds={(form.audienceUserIds ?? []).filter((id) => students.some((s) => s.id === id))}
                  onFacultyUserIds={(ids) => setForm({ ...form, audienceUserIds: [...ids, ...(form.audienceUserIds ?? []).filter((id) => students.some((s) => s.id === id))] })}
                  onStudentUserIds={(ids) => setForm({ ...form, audienceUserIds: [...(form.audienceUserIds ?? []).filter((id) => faculty.some((f) => f.id === id)), ...ids] })}
                  faculty={faculty}
                  students={students}
                />
              )}

              <ModeRow
                label="Who can start a new thread (post)"
                facultyMode={form.postFacultyMode ?? "ALL"}
                studentMode={form.postStudentMode ?? "ALL"}
                onFacultyMode={(m) => setForm({ ...form, postFacultyMode: m })}
                onStudentMode={(m) => setForm({ ...form, postStudentMode: m })}
                facultyUserIds={(form.postUserIds ?? []).filter((id) => faculty.some((f) => f.id === id))}
                studentUserIds={(form.postUserIds ?? []).filter((id) => students.some((s) => s.id === id))}
                onFacultyUserIds={(ids) => setForm({ ...form, postUserIds: [...ids, ...(form.postUserIds ?? []).filter((id) => students.some((s) => s.id === id))] })}
                onStudentUserIds={(ids) => setForm({ ...form, postUserIds: [...(form.postUserIds ?? []).filter((id) => faculty.some((f) => f.id === id)), ...ids] })}
                faculty={faculty}
                students={students}
              />

              <ModeRow
                label="Who can comment (reply)"
                facultyMode={form.commentFacultyMode ?? "ALL"}
                studentMode={form.commentStudentMode ?? "ALL"}
                onFacultyMode={(m) => setForm({ ...form, commentFacultyMode: m })}
                onStudentMode={(m) => setForm({ ...form, commentStudentMode: m })}
                facultyUserIds={(form.commentUserIds ?? []).filter((id) => faculty.some((f) => f.id === id))}
                studentUserIds={(form.commentUserIds ?? []).filter((id) => students.some((s) => s.id === id))}
                onFacultyUserIds={(ids) => setForm({ ...form, commentUserIds: [...ids, ...(form.commentUserIds ?? []).filter((id) => students.some((s) => s.id === id))] })}
                onStudentUserIds={(ids) => setForm({ ...form, commentUserIds: [...(form.commentUserIds ?? []).filter((id) => faculty.some((f) => f.id === id)), ...ids] })}
                faculty={faculty}
                students={students}
              />

              <button
                type="submit"
                disabled={!canSaveCategory || saving}
                style={{ ...smallBtn, padding: "11px 18px", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: !canSaveCategory || saving ? 0.7 : 1 }}
              >
                {saving && <Spinner />}
                {saving ? "Saving…" : editingCategory ? "Save changes" : "Create category"}
              </button>
              {saveError && <span style={{ color: "var(--red)", fontSize: 12 }}>{saveError}</span>}
            </form>
          </Modal>
        )}

        {!openThreadId ? (
          loading ? (
            <p style={{ color: "var(--ink2)" }}>Loading…</p>
          ) : threads.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}>
              No threads in this category yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
              {threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openThreadView(t.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#f7902b,#f24d1b)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flex: "none" }}>
                    {initials(t.author.fullName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      {t.pinned && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--orange)", background: "var(--orange-soft)", padding: "2px 7px", borderRadius: 6 }}>📌 PINNED</span>}
                      {t.locked && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", background: "var(--bg)", padding: "2px 7px", borderRadius: 6 }}>🔒 LOCKED</span>}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 5 }}>
                      by {t.author.fullName} · {t._count.posts} replies · ▲ {t._count.likes}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          <div style={{ maxWidth: 780 }}>
            <button
              onClick={backToList}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", marginBottom: 18 }}
            >
              ← All threads
            </button>
            {!openThread ? (
              <p style={{ color: "var(--ink2)" }}>Loading…</p>
            ) : (
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: "26px 28px" }}>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1.25 }}>{openThread.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, fontSize: 12.5, color: "var(--ink3)", fontWeight: 600, flexWrap: "wrap" }}>
                  <span>Started by {openThread.author.fullName}</span>
                  <span>{openThread._count.posts} replies</span>
                  <span>▲ {openThread._count.likes}</span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button onClick={onTogglePin} style={{ padding: "6px 12px", background: "var(--bg)", border: "none", borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: "var(--ink2)", fontFamily: "inherit", cursor: "pointer" }}>
                      📌 {openThread.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button onClick={onToggleLock} style={{ padding: "6px 12px", background: "var(--bg)", border: "none", borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: "var(--ink2)", fontFamily: "inherit", cursor: "pointer" }}>
                      🔒 {openThread.locked ? "Unlock" : "Lock"}
                    </button>
                  </span>
                </div>
                <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.6 }}>{openThread.body}</p>
                <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
                  {openThread.posts.map((p) => (
                    <div key={p.id} style={{ display: "flex", gap: 12, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#f7902b,#f24d1b)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flex: "none" }}>
                        {initials(p.author.fullName)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{p.author.fullName}</div>
                        <p style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.55 }}>{p.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
