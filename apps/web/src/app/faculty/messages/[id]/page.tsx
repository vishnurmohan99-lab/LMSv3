"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { messengerApi, usersApi, ApiError, type Message, type Profile } from "@/lib/api";

export default function FacultyConversationThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const conversationId = params.id;

  const [me, setMe] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function load() {
    messengerApi
      .listMessages(conversationId)
      .then((msgs) => {
        setMessages(msgs);
        messengerApi.markRead(conversationId).catch(() => {});
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load messages"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    usersApi.me().then(setMe).catch(() => {});
  }, []);

  useEffect(load, [conversationId]);

  useEffect(() => {
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await messengerApi.sendMessage(conversationId, body.trim());
      setBody("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={{ padding: "30px 30px 60px", maxWidth: 1040, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 60px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <button
          onClick={() => router.push("/faculty/messages")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink2)", fontSize: 14, fontWeight: 700 }}
        >
          ← Back
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--rl)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {loading ? (
          <p style={{ color: "var(--ink2)" }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p style={{ color: "var(--ink2)" }}>No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === me?.id;
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "70%",
                    background: mine ? "var(--orange)" : "var(--bg)",
                    color: mine ? "#fff" : "var(--ink)",
                    border: mine ? "none" : "1px solid var(--line)",
                    borderRadius: 14,
                    padding: "10px 14px",
                    fontSize: 14,
                  }}
                  dangerouslySetInnerHTML={{ __html: m.body }}
                />
                <span style={{ fontSize: 11, color: "var(--ink2)", marginTop: 4 }}>
                  {mine ? "You" : m.sender.fullName} · {new Date(m.createdAt).toLocaleString()}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSend} style={{ display: "flex", gap: 10 }}>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          style={{ flex: 1, padding: "12px 16px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 14, fontFamily: "inherit", outline: "none", background: "var(--bg)" }}
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          style={{
            padding: "12px 22px",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: sending ? "default" : "pointer",
            opacity: sending || !body.trim() ? 0.6 : 1,
          }}
        >
          Send
        </button>
      </form>
    </main>
  );
}
