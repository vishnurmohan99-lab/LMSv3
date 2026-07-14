export const metadata = { title: "Offline — Elearning" };

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 24,
        background: "var(--bg, #faf8f6)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "var(--orange, #f26a1b)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "14px solid #fff",
            borderTop: "9px solid transparent",
            borderBottom: "9px solid transparent",
            marginLeft: 4,
          }}
        />
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>You&apos;re offline</div>
      <p style={{ color: "var(--ink3, #aaa39a)", fontSize: 14, lineHeight: 1.6, maxWidth: 320, marginTop: 8 }}>
        Elearning needs a connection to load your courses, tests and mentors. Reconnect and try again.
      </p>
    </main>
  );
}
