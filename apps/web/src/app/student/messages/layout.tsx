"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessengerProvider } from "@/components/messenger/MessengerContext";
import MessengerSidebar from "@/components/messenger/MessengerSidebar";
import NewConversationModal from "@/components/messenger/NewConversationModal";

export default function StudentMessagesLayout({ children }: { children: React.ReactNode }) {
  const [showNew, setShowNew] = useState(false);
  const pathname = usePathname();
  const threadOpen = pathname !== "/student/messages";

  return (
    <MessengerProvider>
      <div style={{ display: "flex", height: "100%" }}>
        <MessengerSidebar
          basePath="/student/messages"
          onNewMessage={() => setShowNew(true)}
          className={`messenger-list-pane${threadOpen ? " has-selection" : ""}`}
        />
        <div className={`messenger-thread-pane${threadOpen ? " has-selection" : ""}`} style={{ flex: 1, minWidth: 0, display: "flex" }}>
          {children}
        </div>
      </div>
      {showNew && <NewConversationModal basePath="/student/messages" mode="contact-only" onClose={() => setShowNew(false)} />}
    </MessengerProvider>
  );
}
