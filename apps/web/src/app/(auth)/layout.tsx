export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <div
        style={{
          flex: 1,
          background: "#141414",
          color: "#fff",
          padding: 56,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: "linear-gradient(135deg,#f7902b,#f24d1b)",
              transform: "rotate(45deg)",
            }}
          />
          <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Elearning</span>
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 2,
              color: "var(--orange)",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            AI Exam Prep
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1, maxWidth: 420 }}>
            Learn smarter, not harder.
          </div>
          <p style={{ color: "#9a9a9a", fontSize: 15, lineHeight: 1.6, maxWidth: 380, marginTop: 18 }}>
            Adaptive flashcards, AI-narrated decks and an always-on doubt solver — built around your
            syllabus.
          </p>
        </div>
        <div style={{ display: "flex", gap: 28, color: "#bdbdbd", fontSize: 13 }}>
          <span>
            <b style={{ color: "#fff", fontSize: 20 }}>120k+</b>
            <br />
            Students
          </span>
          <span>
            <b style={{ color: "#fff", fontSize: 20 }}>8.4k</b>
            <br />
            Lessons
          </span>
          <span>
            <b style={{ color: "#fff", fontSize: 20 }}>4.9★</b>
            <br />
            Rating
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            right: -90,
            bottom: -90,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(242,106,27,.35),transparent 70%)",
          }}
        />
      </div>

      <div style={{ flex: 1.05, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ width: "100%", maxWidth: 400 }}>{children}</div>
      </div>
    </div>
  );
}
