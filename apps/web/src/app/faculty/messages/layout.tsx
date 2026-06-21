"use client";

import { useState } from "react";
import { MessengerProvider } from "@/components/messenger/MessengerContext";
import MessengerSidebar from "@/components/messenger/MessengerSidebar";
import NewConversationModal from "@/components/messenger/NewConversationModal";

export default function FacultyMessagesLayout({ children }: { children: React.ReactNode }) {
  const [showNew, setShowNew] = useState(false);

  return (
    <MessengerProvider>
      <div style={{ display: "flex", height: "100vh" }}>
        <MessengerSidebar basePath="/faculty/messages" onNewMessage={() => setShowNew(true)} />
        {children}
      </div>
      {showNew && <NewConversationModal basePath="/faculty/messages" mode="full" onClose={() => setShowNew(false)} />}
    </MessengerProvider>
  );
}
