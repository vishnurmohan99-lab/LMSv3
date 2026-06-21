"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { messengerApi, usersApi, ApiError, type Conversation, type Profile } from "@/lib/api";
import Modal from "@/components/Modal";

type Contact = { id: string; fullName: string; email: string; role: "STUDENT" | "FACULTY" | "ADMIN" };

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
  width: "100%",
};

function conversationLabel(c: Conversation, myId: string) {
  if (c.type === "DIRECT") {
    const other = c.participants.find((p) => p.userId !== myId);
    return other ? other.user.fullName : "Direct message";
  }
  if (c.type === "COURSE_BROADCAST") return `${c.course?.title ?? "Course"} (announcement)`;
  if (c.type === "BATCH_BROADCAST") return `${c.batch?.name ?? "Batch"} (announcement)`;
  return "Group conversation";
}

export default function StudentMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Profile | null>(null);

  const [showNewModal, setShowNewModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    messengerApi
      .listConversations()
      .then(setConversations)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load conversations"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useEffect(() => {
    usersApi.me().then(setMe).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showNewModal) return;
    messengerApi.listContacts().then(setContacts).catch(() => {});
  }, [showNewModal]);

  const sorted = useMemo(
    () =>
      [...conversations].sort(
        (a, b) => new Date(b.lastMessage?.createdAt ?? b.createdAt).getTime() - new Date(a.lastMessage?.createdAt ?? a.createdAt).getTime(),
      ),
    [conversations],
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const conversation = await messengerApi.createConversation({ type: "DIRECT", userId: selectedUserId });
      setShowNewModal(false);
      setSelectedUserId("");
      load();
      window.location.href = `/student/messages/${conversation.id}`;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start conversation");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Messages</div>
        <button
          onClick={() => setShowNewModal(true)}
          style={{
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
          New message
        </button>
      </div>

      {showNewModal && (
        <Modal title="New message" onClose={() => setShowNewModal(false)}>
          <form onSubmit={onCreate} style={{ display: "grid", gap: 14 }}>
            <select required value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={inputStyle}>
              <option value="">Select a faculty or admin…</option>
              {contacts.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={creating}
              style={{
                padding: "11px 20px",
                background: "var(--ink)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: creating ? "default" : "pointer",
                opacity: creating ? 0.6 : 1,
              }}
            >
              {creating ? "Starting…" : "Start conversation"}
            </button>
          </form>
        </Modal>
      )}

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : sorted.length === 0 ? (
        <p style={{ color: "var(--ink2)" }}>No conversations yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sorted.map((c) => (
            <Link
              key={c.id}
              href={`/student/messages/${c.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--rm)",
                padding: "14px 18px",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>{me ? conversationLabel(c, me.id) : "…"}</div>
                <div style={{ fontSize: 13, color: "var(--ink2)" }}>
                  {c.lastMessage ? `${c.lastMessage.sender?.fullName ?? "Someone"}: ${c.lastMessage.body.replace(/<[^>]+>/g, "").slice(0, 80)}` : "No messages yet"}
                </div>
              </div>
              {c.unreadCount > 0 && (
                <span style={{ background: "var(--orange)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "3px 10px" }}>
                  {c.unreadCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
