"use client";

import Link from "next/link";
import QuestionBrowseList from "@/components/answer-correction/QuestionBrowseList";

export default function FacultyAnswerCorrectionPage() {
  return (
    <div className="fade-in-up" style={{ padding: "30px 36px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>Answer Correction</div>
        <Link href="/faculty/answer-correction/submissions" style={{ color: "var(--orange)", fontWeight: 700, fontSize: 13.5 }}>
          Grading queue →
        </Link>
      </div>
      <p style={{ color: "var(--ink2)", fontSize: 14, marginBottom: 24 }}>
        Practice with a question yourself, or review and grade student submissions.
      </p>
      <QuestionBrowseList basePath="faculty" />
    </div>
  );
}
