"use client";

import { useParams } from "next/navigation";
import RubricBuilder from "@/components/answer-correction/RubricBuilder";

export default function EditAnswerQuestionPage() {
  const params = useParams<{ id: string }>();
  return <RubricBuilder questionId={params.id} />;
}
