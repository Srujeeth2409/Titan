"use client";

import * as React from "react";
import { useState } from "react";
import { ClaudeSidebar } from "@/components/claude-sidebar";
import { ChatConversation } from "@/components/chat-conversation";

export default function WorkstationPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        minHeight: "calc(100vh - 185px)",
      }}
    >
      {/* Claude-style Left Sidebar in Light Glass UI */}
      <ClaudeSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* Main Multi-turn Conversation View */}
      <ChatConversation
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />
    </div>
  );
}
