"use client";

import { useEffect, useRef, useState } from "react";
import { chatApi, ApiError, type ChatMessage } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

export default function AskMeChat({ lessonId, onClose }: { lessonId: string; onClose?: () => void }) {
  const confirm = useConfirm();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    chatApi
      .history(lessonId)
      .then(setMessages)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load conversation"))
      .finally(() => setLoading(false));
  }, [lessonId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;
    setError(null);
    setSending(true);
    setInput("");
    const optimistic: ChatMessage = { id: `pending-${Date.now()}`, role: "USER", content: message, lessonId, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    try {
      const reply = await chatApi.send(lessonId, message);
      setMessages((m) => [...m, reply]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function onReset() {
    if (!(await confirm({ message: "Clear this conversation? This cannot be undone." }))) return;
    await chatApi.reset(lessonId);
    setMessages([]);
  }

  return (
    <div
      className="slide-in-right"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--rl)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxShadow: "0 20px 50px rgba(0,0,0,.12)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 18px",
          borderBottom: "1px solid var(--line)",
          background: "var(--orange)",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Ask a doubt</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {messages.length > 0 && (
            <button onClick={onReset} style={{ background: "none", border: "none", color: "rgba(255,255,255,.85)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              Reset
            </button>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#fff", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: 0 }}>
              ×
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "grid", gap: 10, alignContent: "start", background: "var(--bg)" }}>
        {loading ? (
          <p style={{ color: "var(--ink2)", fontSize: 13 }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p style={{ color: "var(--ink2)", fontSize: 13 }}>Ask a question about this lesson and I&apos;ll answer using its content.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className="fade-in-up"
              style={{
                alignSelf: m.role === "USER" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: 14,
                fontSize: 13.5,
                lineHeight: 1.5,
                background: m.role === "USER" ? "var(--orange)" : "var(--card)",
                color: m.role === "USER" ? "#fff" : "var(--ink)",
                border: m.role === "USER" ? "none" : "1px solid var(--line)",
                whiteSpace: "pre-wrap",
                boxShadow: m.role === "USER" ? "0 4px 12px rgba(242,106,27,.25)" : "none",
              }}
            >
              {m.content}
            </div>
          ))
        )}
        {sending && (
          <p style={{ color: "var(--ink3)", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span className="spin-slow" style={{ display: "inline-block", width: 10, height: 10, border: "2px solid var(--orange-soft)", borderTopColor: "var(--orange)", borderRadius: "50%" }} />
            Thinking…
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 12, padding: "0 16px 8px" }}>{error}</p>}

      <form onSubmit={onSend} style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)", background: "var(--card)" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this lesson…"
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid var(--line)",
            borderRadius: 10,
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
            background: "var(--bg)",
          }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={{
            padding: "10px 18px",
            background: "var(--orange)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: sending ? "default" : "pointer",
            opacity: sending || !input.trim() ? 0.7 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
