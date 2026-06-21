"use client";

import { useState } from "react";
import { MessengerProvider } from "@/components/messenger/MessengerContext";
import MessengerSidebar from "@/components/messenger/MessengerSidebar";
import NewConversationModal from "@/components/messenger/NewConversationModal";

export default function StudentMessagesLayout({ children }: { children: React.ReactNode }) {
  const [showNew, setShowNew] = useState(false);

  return (
    <MessengerProvider>
      <div style={{ display: "flex", height: "100%" }}>
        <MessengerSidebar basePath="/student/messages" onNewMessage={() => setShowNew(true)} />
        {children}
      </div>
      {showNew && <NewConversationModal basePath="/student/messages" mode="contact-only" onClose={() => setShowNew(false)} />}
    </MessengerProvider>
  );
}
