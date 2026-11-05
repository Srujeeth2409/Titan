"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";

// Conversation and Contact Model
interface Contact {
  id: string;
  name: string;
  role: string;
  avatarText: string;
  avatarColor: string;
  online: boolean;
  statusBadge: string;
  lastMessage: string;
  time: string;
  unreadCount?: number;
  email: string;
  phone: string;
  location: string;
  sharedFiles: {
    id: string;
    name: string;
    size: string;
    type: "pdf" | "image" | "figma" | "doc";
  }[];
  suggestedReplies: string[];
}

interface Message {
  id: string;
  sender: "user" | "contact";
  text: string;
  time: string;
}

const INITIAL_CONTACTS: Contact[] = [
  {
    id: "stephanie",
    name: "Stephanie Lane",
    role: "Frontend Developer",
    avatarText: "SL",
    avatarColor: "linear-gradient(135deg, #38bdf8, #2563eb)",
    online: true,
    statusBadge: "Online",
    lastMessage: "I got your first assignment. It w...",
    time: "10:42",
    unreadCount: 2,
    email: "stephanie@studio.io",
    phone: "(555) 201-4410",
    location: "New York",
    suggestedReplies: [
      "Sounds good! I'll send it today",
      "Can we move this to tomorrow?",
      "Thanks for the feedback 🙏",
    ],
    sharedFiles: [
      { id: "f1", name: "Web-Design-Brief.pdf", size: "2.4 MB", type: "pdf" },
      { id: "f2", name: "Hero-Render-4K.png", size: "18.2 MB", type: "image" },
      { id: "f3", name: "Dashboard-Wireframes.fig", size: "11.8 MB", type: "figma" },
    ],
  },
  {
    id: "daniel",
    name: "Daniel Reyes",
    role: "Design Lead",
    avatarText: "DR",
    avatarColor: "linear-gradient(135deg, #06b6d4, #0d9488)",
    online: true,
    statusBadge: "Online",
    lastMessage: "Hey, tell me about progress of...",
    time: "09:15",
    unreadCount: 1,
    email: "daniel.reyes@studio.io",
    phone: "(555) 349-8120",
    location: "San Francisco",
    suggestedReplies: [
      "Progress is right on schedule!",
      "I just pushed the preview build.",
      "Let's review the specs at 2 PM.",
    ],
    sharedFiles: [
      { id: "d1", name: "Design-System-Spec.pdf", size: "4.1 MB", type: "pdf" },
      { id: "d2", name: "Typography-Tokens.fig", size: "6.5 MB", type: "figma" },
    ],
  },
  {
    id: "william",
    name: "William Brooks",
    role: "Backend Architect",
    avatarText: "WB",
    avatarColor: "linear-gradient(135deg, #8b5cf6, #6366f1)",
    online: false,
    statusBadge: "Away",
    lastMessage: "I want some changes in the previou...",
    time: "Yesterday",
    email: "w.brooks@studio.io",
    phone: "(555) 882-9014",
    location: "Austin",
    suggestedReplies: [
      "Noted, I will update the schema.",
      "Check the latest API endpoints.",
    ],
    sharedFiles: [
      { id: "w1", name: "Titan-API-Architecture.pdf", size: "1.8 MB", type: "pdf" },
    ],
  },
  {
    id: "mia",
    name: "Mia Wong",
    role: "Product Designer",
    avatarText: "MW",
    avatarColor: "linear-gradient(135deg, #ec4899, #f43f5e)",
    online: false,
    statusBadge: "Away",
    lastMessage: "Gorgeous palette. Let's lock it in.",
    time: "Yesterday",
    email: "mia.wong@studio.io",
    phone: "(555) 714-3329",
    location: "Toronto",
    suggestedReplies: [
      "Locked in! Exporting tokens now.",
      "Shared the palette in Figma.",
    ],
    sharedFiles: [
      { id: "m1", name: "Color-Harmony-Guide.pdf", size: "3.2 MB", type: "pdf" },
    ],
  },
  {
    id: "liam",
    name: "Liam Cole",
    role: "Mobile Lead",
    avatarText: "LC",
    avatarColor: "linear-gradient(135deg, #f59e0b, #d97706)",
    online: true,
    statusBadge: "Online",
    lastMessage: "Build 1.4 is on TestFlight 🚀",
    time: "Mon",
    email: "liam.cole@studio.io",
    phone: "(555) 492-7711",
    location: "London",
    suggestedReplies: [
      "Downloading the TestFlight build now!",
      "Any known bugs in build 1.4?",
    ],
    sharedFiles: [
      { id: "l1", name: "TestFlight-Release-Notes.pdf", size: "1.1 MB", type: "pdf" },
    ],
  },
  {
    id: "noah",
    name: "Noah Patel",
    role: "DevOps Engineer",
    avatarText: "NP",
    avatarColor: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    online: true,
    statusBadge: "Online",
    lastMessage: "API for invoices is live on staging.",
    time: "Sun",
    email: "noah.patel@studio.io",
    phone: "(555) 603-9941",
    location: "Seattle",
    suggestedReplies: [
      "Testing staging health checks now.",
      "Deployment pipeline looking super clean.",
    ],
    sharedFiles: [
      { id: "n1", name: "Staging-Deployment-Logs.log", size: "840 KB", type: "doc" },
    ],
  },
  {
    id: "titan",
    name: "Titan AI Copilot",
    role: "RAG Neural Engine",
    avatarText: "TI",
    avatarColor: "linear-gradient(135deg, #6366f1, #a855f7)",
    online: true,
    statusBadge: "Active Model",
    lastMessage: "Indexed 14 corporate documents and ready.",
    time: "Just now",
    email: "copilot@titan.ai",
    phone: "Titan API v2.4",
    location: "Cloud Cluster",
    suggestedReplies: [
      "Summarize the latest financial quarterly report",
      "Which documents mention our Q4 roadmap?",
      "Draft an executive briefing from indexed PDFs",
    ],
    sharedFiles: [
      { id: "t1", name: "Titan-Knowledge-Index.json", size: "5.4 MB", type: "doc" },
      { id: "t2", name: "Vector-Embeddings-Report.pdf", size: "3.7 MB", type: "pdf" },
    ],
  },
];

const INITIAL_MESSAGES: Record<string, Message[]> = {
  stephanie: [
    {
      id: "m1",
      sender: "contact",
      text: "Hi Robert! Any thoughts on the new components?",
      time: "10:21",
    },
    {
      id: "m2",
      sender: "user",
      text: "Hey Steph — yes, they look great. The glass cards feel really light.",
      time: "10:24",
    },
    {
      id: "m3",
      sender: "contact",
      text: "Can you please elaborate on the hover states?",
      time: "10:30",
    },
    {
      id: "m4",
      sender: "user",
      text: "Sure. A soft fill plus a brighter rim — I'll share a prototype.",
      time: "10:33",
    },
    {
      id: "m5",
      sender: "contact",
      text: "I got your first assignment. It was quite good 🤝",
      time: "10:42",
    },
  ],
  daniel: [
    {
      id: "d_m1",
      sender: "contact",
      text: "Hey, tell me about progress of the new design system tokens?",
      time: "09:15",
    },
    {
      id: "d_m2",
      sender: "user",
      text: "We finished the color system and liquid glass surfaces. Looking stunning!",
      time: "09:20",
    },
  ],
  titan: [
    {
      id: "t_m1",
      sender: "contact",
      text: "Hello! Titan AI Copilot is online. All 14 corporate documents and project briefs have been vectorized and indexed.",
      time: "10:00",
    },
    {
      id: "t_m2",
      sender: "user",
      text: "Titan, give me a status check on our workstation glassmorphism UI.",
      time: "10:02",
    },
    {
      id: "t_m3",
      sender: "contact",
      text: "Workstation glassmorphism is active! The animated GridPulse runs continuously in the background, with 3 frosted translucent glass cards floating on top with specular borders and ambient refraction.",
      time: "10:03",
    },
  ],
};

export function LiquidGlassWorkstation() {
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [activeContactId, setActiveContactId] = useState<string>("stephanie");
  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [activeDockIcon, setActiveDockIcon] = useState<string>("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeContact = contacts.find((c) => c.id === activeContactId) || contacts[0];
  const activeMessages = messagesMap[activeContactId] || [];

  // Listen for new chat trigger from navbar
  useEffect(() => {
    const handleNewChat = () => {
      setActiveContactId("titan");
    };
    window.addEventListener("titan:new-chat", handleNewChat);
    return () => window.removeEventListener("titan:new-chat", handleNewChat);
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

  const handleSendMessage = (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content) return;

    const newMsg: Message = {
      id: "msg_" + Date.now(),
      sender: "user",
      text: content,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeContactId]: [...(prev[activeContactId] || []), newMsg],
    }));

    if (!textToSend) setInputText("");

    // Simulate realistic AI / contact response
    setTimeout(() => {
      const contactReplies: Record<string, string[]> = {
        stephanie: [
          "Perfect! I'll test that immediately on our staging build.",
          "Awesome, the contrast and specular highlight look so refined now!",
          "Received! Thank you so much for the quick turnaround.",
        ],
        titan: [
          "Query processed against our neural vector index. Analysis complete: all metrics verified with 99.4% confidence.",
          "I have indexed that query and updated our real-time context buffer.",
          "Titan copilot retrieved 3 related passages from indexed documents.",
        ],
      };

      const replies = contactReplies[activeContactId] || [
        "Got it, thanks for updating me!",
        "Looks great, let's keep moving forward.",
      ];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];

      const replyMsg: Message = {
        id: "msg_reply_" + Date.now(),
        sender: "contact",
        text: randomReply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeContactId]: [...(prev[activeContactId] || []), replyMsg],
      }));
    }, 1200);
  };

  const filteredContacts = contacts.filter((c) => {
    const matchesFilter = filterTab === "all" || (filterTab === "unread" && (c.unreadCount || 0) > 0);
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* Glassmorphism Surface Core */
        .glass-card-surface {
          background: rgba(14, 18, 30, 0.62);
          backdrop-filter: blur(28px) saturate(190%);
          -webkit-backdrop-filter: blur(28px) saturate(190%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 26px;
          box-shadow:
            0 24px 60px rgba(0, 0, 0, 0.45),
            0 1px 0 rgba(255, 255, 255, 0.15) inset;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .glass-vertical-dock {
          width: 50px;
          background: rgba(12, 16, 28, 0.65);
          backdrop-filter: blur(24px) saturate(190%);
          -webkit-backdrop-filter: blur(24px) saturate(190%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 9999px;
          padding: 10px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2);
          user-select: none;
          flex-shrink: 0;
        }

        .glass-dock-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(148, 163, 184, 0.85);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 180ms ease;
        }
        .glass-dock-icon-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.08);
          transform: scale(1.08);
        }
        .glass-dock-icon-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 0 18px rgba(255, 255, 255, 0.5);
        }

        /* Conversation item hover */
        .glass-contact-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          border-radius: 16px;
          cursor: pointer;
          transition: all 160ms cubic-bezier(0.4, 0, 0.2, 1);
          margin-bottom: 4px;
        }
        .glass-contact-row:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .glass-contact-row.active {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        /* Message Bubbles */
        .glass-incoming-bubble {
          background: rgba(255, 255, 255, 0.07);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px 18px 18px 4px;
          padding: 12px 16px;
          color: #e2e8f0;
          font-size: 13.5px;
          line-height: 1.45;
          max-width: 78%;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .glass-outgoing-bubble {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.42), rgba(99, 102, 241, 0.48));
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(147, 197, 253, 0.45);
          border-radius: 18px 18px 4px 18px;
          padding: 12px 16px;
          color: #ffffff;
          font-size: 13.5px;
          line-height: 1.45;
          max-width: 78%;
          box-shadow:
            0 6px 24px rgba(59, 130, 246, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }

        .glass-suggested-chip {
          padding: 6px 14px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          font-size: 12px;
          color: rgba(226, 232, 240, 0.9);
          cursor: pointer;
          transition: all 180ms ease;
          white-space: nowrap;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .glass-suggested-chip:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
          color: #ffffff;
          transform: translateY(-1px);
        }

        .custom-glass-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .custom-glass-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-glass-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 9999px;
        }
        .custom-glass-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.22);
        }
      `}} />

      {/* Main Workstation Layout Container */}
      <div
        style={{
          width: "100%",
          height: "calc(100vh - 100px)",
          display: "flex",
          gap: "16px",
          padding: "4px 20px 10px 20px",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {/* ── 1. Far Left Vertical Capsule Dock (from reference image) ── */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div className="glass-vertical-dock">
            {/* Home */}
            <button
              type="button"
              onClick={() => setActiveDockIcon("home")}
              className={`glass-dock-icon-btn${activeDockIcon === "home" ? " active" : ""}`}
              title="Home"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>

            {/* Chat (active highlighted) */}
            <button
              type="button"
              onClick={() => setActiveDockIcon("chat")}
              className={`glass-dock-icon-btn${activeDockIcon === "chat" ? " active" : ""}`}
              title="Messages"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* Grid / Projects */}
            <button
              type="button"
              onClick={() => setActiveDockIcon("grid")}
              className={`glass-dock-icon-btn${activeDockIcon === "grid" ? " active" : ""}`}
              title="Apps & Grid"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </button>

            {/* Downloads */}
            <button
              type="button"
              onClick={() => setActiveDockIcon("download")}
              className={`glass-dock-icon-btn${activeDockIcon === "download" ? " active" : ""}`}
              title="Downloads"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>

            {/* Bookmark */}
            <button
              type="button"
              onClick={() => setActiveDockIcon("bookmark")}
              className={`glass-dock-icon-btn${activeDockIcon === "bookmark" ? " active" : ""}`}
              title="Bookmarks"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* Location / Pin */}
            <button
              type="button"
              onClick={() => setActiveDockIcon("location")}
              className={`glass-dock-icon-btn${activeDockIcon === "location" ? " active" : ""}`}
              title="Locations"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </button>

            {/* Heart / Favorites */}
            <button
              type="button"
              onClick={() => setActiveDockIcon("heart")}
              className={`glass-dock-icon-btn${activeDockIcon === "heart" ? " active" : ""}`}
              title="Favorites"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── 2. Column 1: Messages List Card (Left Card) ── */}
        <div
          className="glass-card-surface"
          style={{
            width: "330px",
            flexShrink: 0,
            padding: "20px 18px",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: "16px" }}>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.02em",
                margin: "0 0 4px 0",
              }}
            >
              Messages
            </h1>
            <p
              style={{
                fontSize: "12px",
                color: "rgba(148, 163, 184, 0.8)",
                margin: 0,
              }}
            >
              Chat with your team and clients
            </p>
          </div>

          {/* Search bar */}
          <div
            style={{
              position: "relative",
              marginBottom: "14px",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(148, 163, 184, 0.7)"
              strokeWidth="2"
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search for..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                borderRadius: "9999px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#ffffff",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Segmented Filter Pills: All / Unread */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "3px",
              borderRadius: "9999px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              marginBottom: "16px",
            }}
          >
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: "9999px",
                border: "none",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms ease",
                background: filterTab === "all" ? "rgba(255, 255, 255, 0.18)" : "transparent",
                color: filterTab === "all" ? "#ffffff" : "rgba(148, 163, 184, 0.8)",
                boxShadow: filterTab === "all" ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
              }}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("unread")}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: "9999px",
                border: "none",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms ease",
                background: filterTab === "unread" ? "rgba(255, 255, 255, 0.18)" : "transparent",
                color: filterTab === "unread" ? "#ffffff" : "rgba(148, 163, 184, 0.8)",
                boxShadow: filterTab === "unread" ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
              }}
            >
              Unread
            </button>
          </div>

          {/* Conversation List */}
          <div
            className="custom-glass-scroll"
            style={{
              flex: 1,
              overflowY: "auto",
              paddingRight: "2px",
            }}
          >
            {filteredContacts.map((contact) => {
              const isSelected = contact.id === activeContactId;
              return (
                <div
                  key={contact.id}
                  onClick={() => setActiveContactId(contact.id)}
                  className={`glass-contact-row${isSelected ? " active" : ""}`}
                >
                  {/* Avatar circle */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: contact.avatarColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#ffffff",
                        boxShadow: "0 0 12px rgba(0,0,0,0.3)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                      }}
                    >
                      {contact.avatarText}
                    </div>
                    {contact.online && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: "9px",
                          height: "9px",
                          borderRadius: "50%",
                          background: "#10b981",
                          border: "1.5px solid #0f172a",
                          boxShadow: "0 0 6px #10b981",
                        }}
                      />
                    )}
                  </div>

                  {/* Info text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {contact.name}
                      </span>
                      <span style={{ fontSize: "11px", color: "rgba(148, 163, 184, 0.7)", whiteSpace: "nowrap" }}>
                        {contact.time}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "rgba(148, 163, 184, 0.8)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "180px",
                        }}
                      >
                        {contact.lastMessage}
                      </span>
                      {contact.unreadCount ? (
                        <span
                          style={{
                            background: "#3b82f6",
                            color: "#ffffff",
                            fontSize: "10.5px",
                            fontWeight: 700,
                            borderRadius: "9999px",
                            padding: "1px 6px",
                            minWidth: "16px",
                            textAlign: "center",
                            boxShadow: "0 0 8px rgba(59, 130, 246, 0.6)",
                          }}
                        >
                          {contact.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 3. Column 2: Active Conversation Card (Center Card) ── */}
        <div
          className="glass-card-surface"
          style={{
            flex: 1,
            minWidth: "460px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header inside card */}
          <div
            style={{
              padding: "16px 22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(255, 255, 255, 0.02)",
            }}
          >
            {/* Left: Contact Info */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: activeContact.avatarColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#ffffff",
                    boxShadow: "0 0 14px rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                  }}
                >
                  {activeContact.avatarText}
                </div>
                {activeContact.online && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#10b981",
                      border: "2px solid #0f172a",
                      boxShadow: "0 0 8px #10b981",
                    }}
                  />
                )}
              </div>
              <div>
                <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", margin: 0, lineHeight: 1.2 }}>
                  {activeContact.name}
                </h2>
                <span style={{ fontSize: "11.5px", color: activeContact.online ? "#10b981" : "rgba(148, 163, 184, 0.7)", fontWeight: 500 }}>
                  {activeContact.statusBadge}
                </span>
              </div>
            </div>

            {/* Right: Phone, Video, More buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                className="liquid-pill-btn"
                style={{ width: "34px", height: "34px" }}
                title="Voice Call"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>

              <button
                type="button"
                className="liquid-pill-btn"
                style={{ width: "34px", height: "34px" }}
                title="Video Call"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </button>

              <button
                type="button"
                className="liquid-pill-btn"
                style={{ width: "34px", height: "34px" }}
                title="More Options"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                  <circle cx="5" cy="12" r="1.5" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div
            className="custom-glass-scroll"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "18px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {/* "Today" date divider */}
            <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 12px 0" }}>
              <span
                style={{
                  padding: "4px 14px",
                  borderRadius: "9999px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "rgba(148, 163, 184, 0.75)",
                  letterSpacing: "0.02em",
                }}
              >
                Today
              </span>
            </div>

            {/* Messages */}
            {activeMessages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                    alignItems: "flex-end",
                    gap: "8px",
                  }}
                >
                  {!isUser && (
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: activeContact.avatarColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        color: "#fff",
                        flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      }}
                    >
                      {activeContact.avatarText}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
                    <div className={isUser ? "glass-outgoing-bubble" : "glass-incoming-bubble"}>
                      {msg.text}
                    </div>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "rgba(148, 163, 184, 0.6)",
                        marginTop: "3px",
                        padding: "0 4px",
                      }}
                    >
                      {msg.time}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggested Replies Row */}
          <div
            style={{
              padding: "8px 20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              overflowX: "auto",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "rgba(148, 163, 184, 0.8)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
              }}
            >
              <span>✨</span> Suggested
            </span>
            {activeContact.suggestedReplies.map((reply, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSendMessage(reply)}
                className="glass-suggested-chip"
              >
                {reply}
              </button>
            ))}
          </div>

          {/* Bottom Floating Pill Message Input Bar */}
          <div
            style={{
              padding: "12px 20px 16px",
              background: "rgba(255, 255, 255, 0.02)",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "6px 10px 6px 14px",
                borderRadius: "9999px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              {/* Attachment Paperclip */}
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(148, 163, 184, 0.8)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                }}
                title="Attach Document"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>

              {/* Text Input */}
              <input
                type="text"
                placeholder={`Message ${activeContact.name.split(" ")[0]}...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#ffffff",
                  fontSize: "13.5px",
                  padding: "4px 6px",
                }}
              />

              {/* Emoji Picker Button */}
              <button
                type="button"
                onClick={() => setInputText((prev) => prev + " 🤝")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(148, 163, 184, 0.8)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                }}
                title="Insert Emoji"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>

              {/* Blue Circular Send Button */}
              <button
                type="submit"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 0 14px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
                  transition: "all 150ms ease",
                }}
                title="Send Message"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        {/* ── 4. Column 3: Profile & Shared Files Card (Right Card) ── */}
        <div
          className="glass-card-surface"
          style={{
            width: "330px",
            flexShrink: 0,
            padding: "20px 18px",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#ffffff", margin: 0 }}>
              Profile
            </h2>
          </div>

          <div
            className="custom-glass-scroll"
            style={{
              flex: 1,
              overflowY: "auto",
              paddingRight: "2px",
            }}
          >
            {/* Large Avatar Centerpiece */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: "20px" }}>
              <div style={{ position: "relative", marginBottom: "12px" }}>
                <div
                  style={{
                    width: "82px",
                    height: "82px",
                    borderRadius: "50%",
                    background: activeContact.avatarColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "26px",
                    fontWeight: 800,
                    color: "#ffffff",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                    border: "2px solid rgba(255, 255, 255, 0.25)",
                  }}
                >
                  {activeContact.avatarText}
                </div>
                {activeContact.online && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: "2px",
                      right: "2px",
                      width: "15px",
                      height: "15px",
                      borderRadius: "50%",
                      background: "#10b981",
                      border: "2.5px solid #0f172a",
                      boxShadow: "0 0 10px #10b981",
                    }}
                  />
                )}
              </div>

              <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#ffffff", margin: "0 0 3px 0" }}>
                {activeContact.name}
              </h3>
              <p style={{ fontSize: "12.5px", color: "rgba(148, 163, 184, 0.8)", margin: "0 0 8px 0" }}>
                {activeContact.role}
              </p>

              {/* Online status pill badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  borderRadius: "9999px",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "#34d399",
                }}
              >
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
                <span>Online</span>
              </div>
            </div>

            {/* Action Buttons: Email & Share */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <button
                type="button"
                onClick={() => alert(`Sending email to ${activeContact.email}`)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "7px",
                  padding: "8px 0",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  color: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>Email</span>
              </button>

              <button
                type="button"
                onClick={() => alert(`Sharing profile of ${activeContact.name}`)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "7px",
                  padding: "8px 0",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  color: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span>Share</span>
              </button>
            </div>

            {/* Contact Meta Details Card */}
            <div
              style={{
                padding: "14px",
                borderRadius: "16px",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                marginBottom: "22px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div>
                <span style={{ fontSize: "11px", color: "rgba(148, 163, 184, 0.7)", display: "block", marginBottom: "2px" }}>
                  Email address
                </span>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#ffffff" }}>
                  {activeContact.email}
                </span>
              </div>

              <div>
                <span style={{ fontSize: "11px", color: "rgba(148, 163, 184, 0.7)", display: "block", marginBottom: "2px" }}>
                  Phone
                </span>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#ffffff" }}>
                  {activeContact.phone}
                </span>
              </div>

              <div>
                <span style={{ fontSize: "11px", color: "rgba(148, 163, 184, 0.7)", display: "block", marginBottom: "2px" }}>
                  Location
                </span>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#ffffff" }}>
                  {activeContact.location}
                </span>
              </div>
            </div>

            {/* SHARED FILES Section */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "rgba(148, 163, 184, 0.8)",
                  }}
                >
                  Shared Files
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {activeContact.sharedFiles.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "9px 12px",
                      borderRadius: "12px",
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.07)",
                      transition: "all 150ms ease",
                      cursor: "pointer",
                    }}
                  >
                    {/* File icon */}
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#93c5fd",
                        flexShrink: 0,
                      }}
                    >
                      {file.type === "pdf" ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      ) : file.type === "image" ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
                          <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
                          <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
                          <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z" />
                          <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
                        </svg>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 500,
                          color: "#ffffff",
                          display: "block",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {file.name}
                      </span>
                      <span style={{ fontSize: "11px", color: "rgba(148, 163, 184, 0.7)" }}>
                        {file.size}
                      </span>
                    </div>

                    <button
                      type="button"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "rgba(148, 163, 184, 0.7)",
                        cursor: "pointer",
                        padding: "4px",
                      }}
                      title="Download"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
