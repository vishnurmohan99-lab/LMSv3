"use client";

import QuestionBrowseList from "@/components/answer-correction/QuestionBrowseList";

export default function StudentAnswerCorrectionPage() {
  return (
    <div className="fade-in-up" style={{ padding: "30px 36px 60px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, marginBottom: 4 }}>Answer Correction</div>
      <p style={{ color: "var(--ink2)", fontSize: 14, marginBottom: 24 }}>
        Upload a photo of your handwritten answer and get an instant AI evaluation.
      </p>
      <QuestionBrowseList basePath="student" />
    </div>
  );
}
