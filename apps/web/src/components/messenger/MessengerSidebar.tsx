"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMessenger, conversationLabel, conversationMeta, conversationInitials } from "./MessengerContext";

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function MessengerSidebar({
  basePath,
  onNewMessage,
  className,
}: {
  basePath: string;
  onNewMessage: () => void;
  className?: string;
}) {
  const { me, conversations, loading, error } = useMessenger();
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    const filtered = me
      ? conversations.filter((c) => conversationLabel(c, me.id).toLowerCase().includes(search.toLowerCase()))
      : conversations;
    return [...filtered].sort(
      (a, b) => new Date(b.lastMessage?.createdAt ?? b.createdAt).getTime() - new Date(a.lastMessage?.createdAt ?? a.createdAt).getTime(),
    );
  }, [conversations, search, me]);

  return (
    <aside
      className={className}
      style={{ width: 330, flex: "none", borderRight: "1px solid var(--line)", background: "var(--card)", display: "flex", flexDirection: "column" }}
    >
      <div style={{ padding: "18px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Messages</div>
          <button
            onClick={onNewMessage}
            title="New message"
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              border: "none",
              background: "var(--orange)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <PlusIcon />
          </button>
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 13, top: 11 }}>
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            style={{
              width: "100%",
              padding: "9px 14px 9px 36px",
              border: "1px solid var(--line)",
              borderRadius: 10,
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
              background: "var(--bg)",
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {loading ? (
          <p style={{ color: "var(--ink2)", fontSize: 13, padding: "10px 14px" }}>Loading…</p>
        ) : error ? (
          <p style={{ color: "var(--red)", fontSize: 13, padding: "10px 14px" }}>{error}</p>
        ) : sorted.length === 0 ? (
          <p style={{ color: "var(--ink2)", fontSize: 13, padding: "10px 14px" }}>No conversations yet.</p>
        ) : (
          sorted.map((c) => {
            const active = activeId === c.id;
            const isGroup = c.type !== "DIRECT";
            return (
              <button
                key={c.id}
                onClick={() => router.push(`${basePath}/${c.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 14px",
                  border: "none",
                  borderRadius: 13,
                  background: active ? "var(--orange-soft)" : "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: isGroup ? 12 : "50%",
                    background: active ? "var(--orange)" : "var(--ink)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 13,
                    flex: "none",
                  }}
                >
                  {me ? conversationInitials(c, me.id) : ""}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {me ? conversationLabel(c, me.id) : "…"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--ink3)", flex: "none" }}>
                      {c.lastMessage ? timeAgo(c.lastMessage.createdAt) : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                    {c.lastMessage ? `${c.lastMessage.sender?.fullName ?? "Someone"}: ${c.lastMessage.body.replace(/<[^>]+>/g, "")}` : conversationMeta(c)}
                  </div>
                </div>
                {c.unreadCount > 0 && (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      background: "var(--orange)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                      padding: "0 5px",
                    }}
                  >
                    {c.unreadCount}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
