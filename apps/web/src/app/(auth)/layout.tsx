export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <div
        style={{
          flex: 1,
          background: "linear-gradient(160deg,#3f238a 0%,#5a2ed6 60%,#7c5cfc 100%)",
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
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "var(--orange)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "8px solid #fff",
                borderTop: "5.5px solid transparent",
                borderBottom: "5.5px solid transparent",
                marginLeft: 2,
                transform: "rotate(-90deg)",
              }}
            />
          </div>
          <span style={{ fontSize: 17, fontWeight: 800 }}>Elearning</span>
        </div>
        <div>
          <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.5, maxWidth: 380 }}>
            Study with intent.
            <br />
            Rank with proof.
          </div>
          <p style={{ color: "#dbcfff", fontSize: 14, lineHeight: 1.65, maxWidth: 340, marginTop: 14 }}>
            Adaptive flashcards, AI-narrated decks and an always-on doubt solver — built around your
            syllabus.
          </p>
          <div
            style={{
              background: "rgba(255,255,255,.1)",
              border: "1px solid rgba(255,255,255,.18)",
              borderRadius: 16,
              padding: 16,
              marginTop: 28,
            }}
          >
            <div style={{ fontSize: 15, color: "#ffce7a", letterSpacing: 2 }}>★★★★★</div>
            <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.6, marginTop: 6 }}>
              &ldquo;Went from the 61st to the 94th percentile in 3 months. The per-question review changed how I
              study.&rdquo;
            </div>
            <div style={{ fontSize: 11, color: "#c0a9ff", marginTop: 8 }}>Sana L. · cleared CAT &apos;25</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 28, color: "#c0a9ff", fontSize: 13 }}>
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
      </div>

      <div style={{ flex: 1.05, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ width: "100%", maxWidth: 400 }}>{children}</div>
      </div>
    </div>
  );
}
