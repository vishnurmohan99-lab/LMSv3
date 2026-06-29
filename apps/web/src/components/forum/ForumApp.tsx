"use client";

import { useEffect, useState } from "react";
import { forumApi, usersApi, ApiError, type ForumCategory, type ForumThread, type ForumThreadDetail, type Profile } from "@/lib/api";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
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

  return (
    <div className="forum-shell" style={{ display: "flex", height: "100%", minHeight: "calc(100vh - 70px)" }}>
      <aside className="forum-categories" style={{ width: 240, flex: "none", borderRight: "1px solid var(--line)", background: "var(--card)", padding: "18px 12px", overflowY: "auto" }}>
        <div className="forum-categories-label" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: 1, padding: "0 6px 10px" }}>Categories</div>
        <div className="forum-categories-list" style={{ display: "grid", gap: 3 }}>
          {[{ id: "all", name: "All Topics", count: categories.reduce((s, c) => s + c.count, 0) }, ...categories].map((c) => {
            const active = activeCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCategory(c.id);
                  setView("list");
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

      <div className="mobile-page-pad" style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "24px 30px" }}>
        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

        {view === "new" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <button
              onClick={() => setView("list")}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", marginBottom: 18 }}
            >
              ← All threads
            </button>
            <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: "26px 28px" }}>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.3, marginBottom: 18 }}>Start a new thread</div>
              {postableCategories.length === 0 ? (
                <p style={{ color: "var(--ink3)", fontSize: 13.5 }}>You don&apos;t have permission to post in any forum category right now.</p>
              ) : (
                <>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>Category</label>
                  <select
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    style={{ width: "100%", margin: "8px 0 16px", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 11, fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "var(--bg)", color: "var(--ink)" }}
                  >
                    <option value="">Select a category…</option>
                    {postableCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>Title</label>
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="What's your question or topic?"
                    style={{ width: "100%", margin: "8px 0 16px", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 11, fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "var(--bg)" }}
                  />
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)" }}>Description</label>
                  <textarea
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                    placeholder="Share details…"
                    style={{ width: "100%", margin: "8px 0 20px", padding: "13px 15px", border: "1px solid var(--line)", borderRadius: 12, fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.6, outline: "none", resize: "vertical", minHeight: 110, background: "var(--bg)" }}
                  />
                  <button
                    onClick={onCreateThread}
                    disabled={!newTitle.trim() || !newBody.trim() || !newCategoryId || creating}
                    style={{ width: "100%", padding: 14, background: !newTitle.trim() || !newBody.trim() || !newCategoryId || creating ? "var(--line)" : "var(--ink)", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: creating ? "default" : "pointer" }}
                  >
                    {creating ? "Posting…" : "Post thread"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {view === "thread" && (
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <button
              onClick={backToList}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", marginBottom: 18 }}
            >
              ← All threads
            </button>
            {!openThread ? (
              <p style={{ color: "var(--ink2)" }}>Loading…</p>
            ) : (
              <>
                <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: "26px 28px" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1.25 }}>{openThread.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, fontSize: 12.5, color: "var(--ink3)", fontWeight: 600, flexWrap: "wrap" }}>
                    <span>Started by {openThread.author.fullName}</span>
                    <span>{openThread._count.posts} replies</span>
                    <button onClick={onToggleLike} style={{ border: "none", background: "none", cursor: "pointer", color: openThread.likedByMe ? "var(--orange)" : "var(--ink3)", fontWeight: 700, padding: 0, fontSize: 12.5 }}>
                      ▲ {openThread._count.likes}
                    </button>
                    {isAdmin && (
                      <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                        <button onClick={onTogglePin} style={{ padding: "6px 12px", background: "var(--bg)", border: "none", borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: "var(--ink2)", fontFamily: "inherit", cursor: "pointer" }}>
                          📌 {openThread.pinned ? "Unpin" : "Pin"}
                        </button>
                        <button onClick={onToggleLock} style={{ padding: "6px 12px", background: "var(--bg)", border: "none", borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: "var(--ink2)", fontFamily: "inherit", cursor: "pointer" }}>
                          🔒 {openThread.locked ? "Unlock" : "Lock"}
                        </button>
                      </span>
                    )}
                  </div>
                  <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.6, color: "var(--ink)" }}>{openThread.body}</p>
                  <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
                    {openThread.posts.map((p) => (
                      <div key={p.id} style={{ display: "flex", gap: 12, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#f7902b,#f24d1b)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flex: "none" }}>
                          {initials(p.author.fullName)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{p.author.fullName}</span>
                            <span style={{ fontSize: 11, color: "var(--ink3)" }}>{timeAgo(p.createdAt)}</span>
                          </div>
                          <p style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.55 }}>{p.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {openThread.locked ? (
                  <div style={{ marginTop: 16, padding: "14px 18px", background: "var(--bg)", borderRadius: "var(--rm)", fontSize: 13, color: "var(--ink3)", fontWeight: 600, textAlign: "center" }}>
                    🔒 This thread is locked — no new replies.
                  </div>
                ) : !openThread.canComment ? (
                  <div style={{ marginTop: 16, padding: "14px 18px", background: "var(--bg)", borderRadius: "var(--rm)", fontSize: 13, color: "var(--ink3)", fontWeight: 600, textAlign: "center" }}>
                    You don&apos;t have permission to comment in this category.
                  </div>
                ) : (
                  <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rl)", padding: "18px 20px", marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Write a reply…"
                      style={{ flex: 1, padding: "13px 16px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "var(--bg)" }}
                    />
                    <button
                      onClick={onReply}
                      disabled={!reply.trim() || posting}
                      style={{ padding: "13px 24px", background: !reply.trim() || posting ? "var(--line)" : "var(--orange)", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: posting ? "default" : "pointer" }}
                    >
                      Post reply
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {view === "list" && (
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <div className="mobile-stack-header" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search threads…"
                  style={{ width: "100%", padding: "12px 16px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "var(--card)" }}
                />
              </div>
              <button
                onClick={() => setView("new")}
                style={{ padding: "12px 22px", background: "var(--ink)", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                New thread
              </button>
            </div>
            {loading ? (
              <p style={{ color: "var(--ink2)" }}>Loading…</p>
            ) : threads.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)" }}>
                No threads yet — start the conversation.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
