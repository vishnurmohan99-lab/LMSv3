"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { messengerApi, ApiError, type Message } from "@/lib/api";
import { useMessenger, conversationLabel, conversationMeta } from "./MessengerContext";

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.9">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  );
}
function AttachIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="1.9">
      <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.2-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.59l8.49-8.48" />
    </svg>
  );
}
function ClockIcon({ size = 18, color = "var(--ink2)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m22 2-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
function ReadCheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.4">
      <path d="M1 13l4 4L13 7" />
      <path d="M9 13l4 4L23 5" />
    </svg>
  );
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function MessengerThread({ conversationId, basePath }: { conversationId: string; basePath?: string }) {
  const { me, conversations } = useMessenger();
  const conversation = conversations.find((c) => c.id === conversationId) ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduling, setScheduling] = useState(false);
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
    setLoading(true);
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
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

  async function onSchedule() {
    if (!body.trim() || !scheduleAt) return;
    setScheduling(true);
    setError(null);
    try {
      await messengerApi.scheduleMessage({ conversationId, body: body.trim(), sendAt: new Date(scheduleAt).toISOString() });
      setBody("");
      setScheduleAt("");
      setShowSchedule(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule message");
    } finally {
      setScheduling(false);
    }
  }

  let lastDate = "";

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: "none", padding: "16px 24px", borderBottom: "1px solid var(--line)", background: "var(--card)", display: "flex", alignItems: "center", gap: 12 }}>
        {basePath && (
          <Link
            href={basePath}
            className="mobile-back-btn"
            aria-label="Back to conversations"
            style={{ width: 30, height: 30, flex: "none", border: "1px solid var(--line)", borderRadius: 9, background: "var(--bg)", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800 }}>{me && conversation ? conversationLabel(conversation, me.id) : "…"}</div>
          <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 1 }}>{conversation ? conversationMeta(conversation) : ""}</div>
        </div>
        <button
          title="Search in conversation"
          style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <SearchIcon />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "var(--bg)", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <p style={{ color: "var(--ink2)", textAlign: "center", fontSize: 13 }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p style={{ color: "var(--ink2)", textAlign: "center", fontSize: 13 }}>No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === me?.id;
            const label = dateLabel(m.createdAt);
            const showSeparator = label !== lastDate;
            lastDate = label;
            return (
              <div key={m.id}>
                {showSeparator && (
                  <div style={{ textAlign: "center", fontSize: 11, color: "var(--ink3)", fontWeight: 600, marginBottom: 12 }}>{label}</div>
                )}
                <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "72%" }}>
                    <div
                      style={{
                        background: mine ? "var(--orange)" : "var(--card)",
                        color: mine ? "#fff" : "var(--ink2)",
                        border: mine ? "none" : "1px solid var(--line)",
                        borderRadius: mine ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                        padding: "10px 14px",
                        fontSize: 13.5,
                        lineHeight: 1.5,
                      }}
                      dangerouslySetInnerHTML={{ __html: m.body }}
                    />
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--ink3)",
                        textAlign: mine ? "right" : "left",
                        marginTop: 3,
                        display: "flex",
                        gap: 3,
                        justifyContent: mine ? "flex-end" : "flex-start",
                        alignItems: "center",
                      }}
                    >
                      {!mine && <span>{m.sender.fullName}</span>}
                      {mine && (
                        <>
                          Sent
                          <ReadCheckIcon />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 12, padding: "0 24px" }}>{error}</p>}

      <div style={{ flex: "none", padding: "14px 20px", borderTop: "1px solid var(--line)", background: "var(--card)" }}>
        {showSchedule && (
          <div className="fade-in-up" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, padding: "10px 12px", background: "var(--bg)", borderRadius: 11 }}>
            <ClockIcon size={16} color="var(--orange)" />
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 9, fontSize: 13, fontFamily: "inherit", outline: "none", background: "var(--card)" }}
            />
            <button
              onClick={onSchedule}
              disabled={!body.trim() || !scheduleAt || scheduling}
              style={{ padding: "8px 16px", background: "var(--orange)", color: "#fff", border: "none", borderRadius: 9, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", opacity: !body.trim() || !scheduleAt || scheduling ? 0.6 : 1 }}
            >
              {scheduling ? "Scheduling…" : "Schedule"}
            </button>
            <button onClick={() => setShowSchedule(false)} style={{ background: "none", border: "none", color: "var(--ink3)", fontSize: 12.5, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        )}
        <form onSubmit={onSend} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            title="Attachments aren't supported yet"
            disabled
            style={{ width: 42, height: 42, flex: "none", borderRadius: 11, border: "1px solid var(--line)", background: "var(--card)", cursor: "default", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}
          >
            <AttachIcon />
          </button>
          <button
            type="button"
            title="Schedule for later"
            onClick={() => setShowSchedule((s) => !s)}
            style={{
              width: 42,
              height: 42,
              flex: "none",
              borderRadius: 11,
              border: "1px solid var(--line)",
              background: showSchedule ? "var(--orange-soft)" : "var(--card)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ClockIcon color={showSchedule ? "var(--orange)" : "var(--ink2)"} />
          </button>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
            style={{ flex: 1, padding: "13px 16px", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "var(--bg)" }}
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            style={{ width: 46, height: 46, flex: "none", borderRadius: 12, border: "none", background: "var(--orange)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: sending || !body.trim() ? 0.6 : 1 }}
          >
            <SendIcon />
          </button>
        </form>
        <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <ClockIcon size={12} color="var(--ink3)" />
          Tip: use the clock to schedule a message for later
        </div>
      </div>
    </div>
  );
}
