"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { messengerApi, usersApi, type Conversation, type Profile } from "@/lib/api";

interface MessengerContextValue {
  me: Profile | null;
  conversations: Conversation[];
  loading: boolean;
  refresh: () => void;
}

const MessengerContext = createContext<MessengerContextValue | null>(null);

export function MessengerProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    messengerApi
      .listConversations()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    usersApi.me().then(setMe).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  return <MessengerContext.Provider value={{ me, conversations, loading, refresh }}>{children}</MessengerContext.Provider>;
}

export function useMessenger() {
  const ctx = useContext(MessengerContext);
  if (!ctx) throw new Error("useMessenger must be used within a MessengerProvider");
  return ctx;
}

export function conversationLabel(c: Conversation, myId: string) {
  if (c.type === "DIRECT") {
    const other = c.participants.find((p) => p.userId !== myId);
    return other ? other.user.fullName : "Direct message";
  }
  if (c.type === "COURSE_BROADCAST") return c.course?.title ?? "Course announcement";
  if (c.type === "BATCH_BROADCAST") return c.batch?.name ?? "Batch announcement";
  return "Group conversation";
}

export function conversationMeta(c: Conversation) {
  if (c.type === "DIRECT") return "Direct message";
  if (c.type === "COURSE_BROADCAST") return "Course announcement";
  if (c.type === "BATCH_BROADCAST") return "Batch announcement";
  return `Group · ${c.participants.length} members`;
}

export function conversationInitials(c: Conversation, myId: string) {
  const label = conversationLabel(c, myId);
  return label.trim().slice(0, 2).toUpperCase();
}
