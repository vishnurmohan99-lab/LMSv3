"use client";

import { useEffect, useMemo, useState } from "react";
import { forumApi, usersApi, ApiError, type ForumCategory, type ForumThread, type ForumThreadDetail, type Profile } from "@/lib/api";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function isMentor(role: "STUDENT" | "FACULTY" | "ADMIN") {
  return role === "FACULTY" || role === "ADMIN";
}

// Lightweight derived "hot" signal — no real hot flag exists, so a thread with a
// healthy amount of discussion is surfaced, mirroring how other pages derive badges.
const HOT_REPLY_THRESHOLD = 5;

function timeAgoShort(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ForumApp() {
  const [me, setMe] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"list" | "thread" | "new">("list");
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<ForumThreadDetail | null>(null);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    usersApi.me().then(setMe).catch(() => {});
  }, []);

  function loadCategories() {
    forumApi.listCategories().then(setCategories).catch(() => {});
  }

  function loadThreads() {
    setLoading(true);
    forumApi
      .listThreads({ categoryId: activeCategory, search })
      .then(setThreads)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load threads"))
      .finally(() => setLoading(false));
  }

  useEffect(loadCategories, []);
  useEffect(loadThreads, [activeCategory, search]);

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? "General";
  }, [categories]);

  function openThreadView(id: string) {
    setOpenThreadId(id);
    setView("thread");
    setError(null);
    forumApi
      .getThread(id)
      .then(setOpenThread)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load thread"));
  }

  function backToList() {
    setView("list");
    setOpenThreadId(null);
    setOpenThread(null);
    loadThreads();
    loadCategories();
  }

  async function onReply() {
    if (!openThreadId || !reply.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await forumApi.addPost(openThreadId, reply.trim());
      setReply("");
      const updated = await forumApi.getThread(openThreadId);
      setOpenThread(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to post reply");
    } finally {
      setPosting(false);
    }
  }

  async function onToggleLike() {
    if (!openThreadId) return;
    try {
      await forumApi.toggleLike(openThreadId);
      const updated = await forumApi.getThread(openThreadId);
      setOpenThread(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to like thread");
    }
  }

  async function onTogglePin() {
    if (!openThread) return;
    try {
      await forumApi.updateThread(openThread.id, { pinned: !openThread.pinned });
      const updated = await forumApi.getThread(openThread.id);
      setOpenThread(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update thread");
    }
  }

  async function onToggleLock() {
    if (!openThread) return;
    try {
      await forumApi.updateThread(openThread.id, { locked: !openThread.locked });
      const updated = await forumApi.getThread(openThread.id);
      setOpenThread(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update thread");
    }
  }

  async function onCreateThread() {
    if (!newTitle.trim() || !newBody.trim() || !newCategoryId) return;
    setCreating(true);
    setError(null);
    try {
      const t = await forumApi.createThread({ title: newTitle.trim(), body: newBody.trim(), categoryId: newCategoryId });
      setNewTitle("");
      setNewBody("");
      setNewCategoryId("");
      setView("list");
      loadThreads();
      loadCategories();
      openThreadView(t.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create thread");
    } finally {
      setCreating(false);
    }
  }

  const isAdmin = me?.role === "ADMIN";
  const postableCategories = categories.filter((c) => c.canPost);
  const chips = [{ id: "all", name: "All Topics", count: categories.reduce((s, c) => s + c.count, 0) }, ...categories];

  const answeredByMentor = openThread ? openThread.posts.some((p) => isMentor(p.author.role)) : false;

  return (
    <div className="mobile-page-pad" style={{ padding: "24px 30px 40px" }}>
      {/* Header bar */}
      <div className="mobile-stack-header" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>Community forum</div>
        <div className="mobile-full-width" style={{ position: "relative", flex: "1 1 200px", maxWidth: 300, marginLeft: "auto" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search threads…"
            style={{ width: "100%", padding: "9px 14px 9px 36px", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12.5, fontFamily: "inherit", outline: "none", background: "var(--line2)", boxSizing: "border-box" }}
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="2" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
        </div>
        <button
          onClick={() => setView("new")}
          style={{ padding: "0 16px", height: 36, background: "var(--orange)", color: "#fff", border: "none", borderRadius: 9, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          + New thread
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {/* LIST */}
      {view === "list" && (
        <div className="fade-in-up">
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
            {chips.map((c) => {
              const active = activeCategory === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 999,
                    border: active ? "none" : "1px solid var(--line)",
                    background: active ? "var(--ink)" : "var(--card)",
                    color: active ? "#fff" : "var(--ink2)",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {c.name}
                  <span style={{ opacity: 0.6, marginLeft: 6 }}>{c.count}</span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <p style={{ color: "var(--ink2)" }}>Loading…</p>
          ) : threads.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16 }}>
              No threads yet — start the conversation.
            </div>
          ) : (
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
              {threads.map((t, i) => {
                const hot = t._count.posts >= HOT_REPLY_THRESHOLD;
                const needsAnswers = t._count.posts === 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => openThreadView(t.id)}
                    className="forum-thread-row"
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      padding: "14px 18px",
                      borderTop: i ? "1px solid var(--line2)" : "none",
                      background: "transparent",
                      border: "none",
                      borderRadius: 0,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--purple-soft)", color: "var(--purple-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flex: "none" }}>
                      {initials(t.author.fullName)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {t.pinned && <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.5, background: "var(--orange-soft)", color: "var(--orange-deep)", borderRadius: 4, padding: "2px 6px", flex: "none" }}>📌 PINNED</span>}
                        <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                        {hot && <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.5, background: "var(--live-soft)", color: "var(--live)", borderRadius: 4, padding: "2px 6px", flex: "none" }}>HOT</span>}
                        {t.locked && <span style={{ fontSize: 10, flex: "none" }}>🔒</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.author.fullName} · {categoryName(t.categoryId)}
                        {needsAnswers ? <span style={{ color: "var(--orange-ink)", fontWeight: 600 }}> · needs answers</span> : null}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flex: "none", width: 44 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{t._count.posts}</div>
                      <div style={{ fontSize: 9.5, color: "var(--ink3)" }}>replies</div>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink3)", flex: "none", width: 28, textAlign: "right" }}>{timeAgoShort(t.createdAt)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* THREAD DETAIL */}
      {view === "thread" && (
        <div className="fade-in-up" style={{ maxWidth: 780 }}>
          <span onClick={backToList} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink3)", cursor: "pointer" }}>← All threads</span>
          {!openThread ? (
            <p style={{ color: "var(--ink2)", marginTop: 14 }}>Loading…</p>
          ) : (
            <>
              <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, padding: 22, marginTop: 14 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--purple-soft)", color: "var(--purple-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flex: "none" }}>
                    {initials(openThread.author.fullName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{openThread.author.fullName}</div>
                    <div style={{ fontSize: 10.5, color: "var(--ink3)" }}>{timeAgo(openThread.createdAt)} · {categoryName(openThread.categoryId)}</div>
                  </div>
                  {answeredByMentor && (
                    <span style={{ fontSize: 10.5, fontWeight: 600, background: "var(--green-soft)", color: "var(--green)", borderRadius: 999, padding: "4px 10px", flex: "none" }}>✓ Answered</span>
                  )}
                  {isAdmin && (
                    <span style={{ display: "flex", gap: 8, flex: "none" }}>
                      <button onClick={onTogglePin} style={{ padding: "6px 12px", background: "var(--bg)", border: "none", borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: "var(--ink2)", fontFamily: "inherit", cursor: "pointer" }}>
                        📌 {openThread.pinned ? "Unpin" : "Pin"}
                      </button>
                      <button onClick={onToggleLock} style={{ padding: "6px 12px", background: "var(--bg)", border: "none", borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: "var(--ink2)", fontFamily: "inherit", cursor: "pointer" }}>
                        🔒 {openThread.locked ? "Unlock" : "Lock"}
                      </button>
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35 }}>{openThread.title}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--ink2)", marginTop: 10 }}>{openThread.body}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: 11.5, fontWeight: 600, color: "var(--ink3)" }}>
                  <button onClick={onToggleLike} style={{ border: "none", background: "none", cursor: "pointer", color: openThread.likedByMe ? "var(--orange-deep)" : "var(--ink3)", fontWeight: 600, padding: 0, fontSize: 11.5, fontFamily: "inherit" }}>
                    ▲ {openThread._count.likes} helpful
                  </button>
                  <span>{openThread._count.posts} replies</span>
                </div>
              </div>

              {openThread.posts.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
                  {openThread.posts.map((p) => {
                    const mentor = isMentor(p.author.role);
                    return (
                      <div
                        key={p.id}
                        style={{
                          background: "var(--card)",
                          border: mentor ? "1.5px solid #b7e4cd" : "1px solid var(--line)",
                          borderRadius: 16,
                          padding: "16px 18px",
                        }}
                      >
                        <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 7 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: mentor ? "var(--orange-soft)" : "var(--purple-soft)", color: mentor ? "var(--orange-deep)" : "var(--purple-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10, flex: "none" }}>
                            {initials(p.author.fullName)}
                          </div>
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{p.author.fullName}</span>
                          {mentor && <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.5, background: "var(--green-soft)", color: "var(--green)", borderRadius: 4, padding: "2px 6px" }}>✓ MENTOR</span>}
                          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink3)", marginLeft: "auto" }}>{timeAgoShort(p.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink2)" }}>{p.body}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {openThread.locked ? (
                <div style={{ marginTop: 16, padding: "14px 18px", background: "var(--bg)", borderRadius: 14, fontSize: 13, color: "var(--ink3)", fontWeight: 600, textAlign: "center" }}>
                  🔒 This thread is locked — no new replies.
                </div>
              ) : !openThread.canComment ? (
                <div style={{ marginTop: 16, padding: "14px 18px", background: "var(--bg)", borderRadius: 14, fontSize: 13, color: "var(--ink3)", fontWeight: 600, textAlign: "center" }}>
                  You don&apos;t have permission to comment in this category.
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Add your reply…"
                    style={{ flex: 1, height: 44, padding: "0 16px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "var(--card)" }}
                  />
                  <button
                    onClick={onReply}
                    disabled={!reply.trim() || posting}
                    style={{ height: 44, padding: "0 20px", background: !reply.trim() || posting ? "var(--line)" : "var(--ink)", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: posting ? "default" : "pointer" }}
                  >
                    Reply
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* NEW THREAD */}
      {view === "new" && (
        <div className="fade-in-up" style={{ maxWidth: 640 }}>
          <span onClick={() => setView("list")} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink3)", cursor: "pointer" }}>← Cancel</span>
          <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 18, padding: 24, marginTop: 14 }}>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3, marginBottom: 16 }}>Start a thread</div>
            {postableCategories.length === 0 ? (
              <p style={{ color: "var(--ink3)", fontSize: 13.5 }}>You don&apos;t have permission to post in any forum category right now.</p>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Title</div>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="One clear question works best…"
                  style={{ width: "100%", height: 44, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 11, fontSize: 14, fontFamily: "inherit", outline: "none", background: "var(--card)", boxSizing: "border-box" }}
                />
                <div style={{ fontSize: 12, fontWeight: 600, margin: "14px 0 6px" }}>Category</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {postableCategories.map((c) => {
                    const active = newCategoryId === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setNewCategoryId(c.id)}
                        style={{
                          padding: "7px 14px",
                          borderRadius: 999,
                          border: active ? "none" : "1px solid var(--line)",
                          background: active ? "var(--ink)" : "var(--card)",
                          color: active ? "#fff" : "var(--ink2)",
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: "inherit",
                          cursor: "pointer",
                        }}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, margin: "14px 0 6px" }}>Details</div>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="What have you tried? Where exactly are you stuck?"
                  style={{ width: "100%", minHeight: 110, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 11, fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.6, outline: "none", resize: "vertical", background: "var(--card)", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setView("list")}
                    style={{ height: 42, padding: "0 18px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onCreateThread}
                    disabled={!newTitle.trim() || !newBody.trim() || !newCategoryId || creating}
                    style={{ height: 42, padding: "0 20px", background: !newTitle.trim() || !newBody.trim() || !newCategoryId || creating ? "var(--line)" : "var(--orange)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: creating ? "default" : "pointer" }}
                  >
                    {creating ? "Posting…" : "Post thread"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
