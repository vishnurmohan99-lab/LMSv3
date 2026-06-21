"use client";

import { useParams } from "next/navigation";
import MessengerThread from "@/components/messenger/MessengerThread";

export default function AdminConversationThreadPage() {
  const params = useParams<{ id: string }>();
  return <MessengerThread conversationId={params.id} />;
}
