"use client";

export default function AdminMessagesEmptyPage() {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ textAlign: "center", color: "var(--ink3)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink2)", marginBottom: 4 }}>Select a conversation</div>
        <div style={{ fontSize: 13 }}>Choose a chat from the left, or start a new one.</div>
      </div>
    </div>
  );
}
