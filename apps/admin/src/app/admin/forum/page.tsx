"use client";

import { useEffect, useState } from "react";
import { forumApi, ApiError, type ForumCategory, type ForumThread, type ForumThreadDetail } from "@/lib/api";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export default function AdminForumPage() {
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<ForumThreadDetail | null>(null);

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

  useEffect(loadCategories, []);
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
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3, marginBottom: 4 }}>Forum moderation</div>
        <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 18 }}>Pin important threads or lock ones that no longer need replies.</p>

        {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

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
