"use client";

import { useParams } from "next/navigation";
import QuestionDetail from "@/components/answer-correction/QuestionDetail";

export default function StudentAnswerCorrectionDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="fade-in-up" style={{ padding: "30px 36px 60px" }}>
      <QuestionDetail questionId={params.id} />
    </div>
  );
}
