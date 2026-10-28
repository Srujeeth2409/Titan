"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useChatStore,
  Conversation,
  Connector,
  Plugin,
} from "@/lib/chat-store";
import { useAuth } from "@/lib/auth-context";

export function ClaudeSidebar({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const {
    conversations,
    activeId,
    setActiveId,
    createNew,
    togglePin,
    rename,
    deleteConvo,
    connectors,
    plugins,
    toggleConnectorItem,
    togglePluginItem,
  } = useChatStore();

  const [isPinnedOpen, setIsPinnedOpen] = useState(true);
  const [isRecentsOpen, setIsRecentsOpen] = useState(true);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [customizeTab, setCustomizeTab] = useState<"connectors" | "plugins">("connectors");

  // Editing title
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const pinnedConversations = conversations.filter((c) => c.pinned);
  const recentConversations = conversations.filter((c) => !c.pinned);

  const filteredSearchConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = c.title.toLowerCase().includes(q);
    const msgMatch = c.messages.some((m) => m.content.toLowerCase().includes(q));
    return titleMatch || msgMatch;
  });

  const handleStartRename = (c: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditingTitle(c.title);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim()) {
      rename(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const userEmail = user?.email || "Srujeeth";
  const userName = userEmail.split("@")[0];
  const initial = userName.charAt(0).toUpperCase();

  return (
    <>
      {/* ── Collapsed trigger button (when sidebar is hidden) ── */}
      {!isOpen && (
        <button
          type="button"
          onClick={onToggle}
          title="Open Sidebar"
          style={{
            position: "fixed",
            top: "80px",
            left: "18px",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            background: "rgba(255, 255, 255, 0.9)",
            border: "1px solid rgba(0, 0, 0, 0.1)",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.06)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            cursor: "pointer",
            color: "#334155",
            transition: "all 180ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.background = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.9)";
          }}
        >
          {/* Sidebar icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      )}

      {/* ── Claude-Style Sidebar Panel ── */}
      <aside
        style={{
          position: "fixed",
          top: "68px",
          left: 0,
          bottom: 0,
          width: "272px",
          zIndex: 40,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 260ms cubic-bezier(0.16, 1, 0.3, 1)",
          background: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(28px) saturate(1.8)",
          WebkitBackdropFilter: "blur(28px) saturate(1.8)",
          borderRight: "1px solid rgba(0, 0, 0, 0.08)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          boxShadow: isOpen ? "4px 0 24px rgba(0, 0, 0, 0.03)" : "none",
          userSelect: "none",
        }}
      >
        {/* Top Header: Brand + Collapse */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 16px 12px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={onToggle}
              title="Close sidebar"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                color: "#64748b",
                borderRadius: "6px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#0f172a")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
            <span
              style={{
                fontFamily: "serif",
                fontSize: "19px",
                fontWeight: 600,
                color: "#0f172a",
                letterSpacing: "-0.01em",
              }}
            >
              Titan
            </span>
          </div>
        </div>

        {/* Action Button: + New */}
        <div style={{ padding: "0 12px 8px 12px" }}>
          <button
            type="button"
            onClick={() => {
              createNew();
              router.push("/app");
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              borderRadius: "12px",
              background: "#ffffff",
              border: "1px solid rgba(0, 0, 0, 0.09)",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
              cursor: "pointer",
              fontSize: "13.5px",
              fontWeight: 500,
              color: "#0f172a",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f8fafc";
              e.currentTarget.style.borderColor = "rgba(79, 70, 229, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#ffffff";
              e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.09)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New chat</span>
          </button>
        </div>

        {/* Navigation Action Rows: Search, Projects, Customize */}
        <div style={{ padding: "4px 12px 10px 12px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {/* Search */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "13.5px",
              color: "#334155",
              textAlign: "left",
              width: "100%",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Search</span>
          </button>

          {/* Projects */}
          <button
            type="button"
            onClick={() => setIsProjectsOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "13.5px",
              color: "#334155",
              textAlign: "left",
              width: "100%",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Projects</span>
          </button>

          {/* Customize (Connectors & Plugins) */}
          <button
            type="button"
            onClick={() => setIsCustomizeOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "13.5px",
              color: "#334155",
              textAlign: "left",
              width: "100%",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            <span>Customize</span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: "10px",
                fontWeight: 600,
                color: "#4f46e5",
                background: "rgba(79, 70, 229, 0.08)",
                padding: "2px 6px",
                borderRadius: "6px",
              }}
            >
              Plugins
            </span>
          </button>
        </div>

        <div style={{ height: "1px", background: "rgba(0,0,0,0.06)", margin: "0 16px 8px 16px" }} />

        {/* Scrollable Chat Lists: Pinned & Recents */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 10px 16px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Pinned Section */}
          {pinnedConversations.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setIsPinnedOpen(!isPinnedOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#64748b",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <span>Pinned</span>
                <span style={{ fontSize: "9px" }}>{isPinnedOpen ? "▾" : "▸"}</span>
              </button>

              {isPinnedOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                  {pinnedConversations.map((c) => (
                    <ConversationRow
                      key={c.id}
                      conversation={c}
                      isActive={c.id === activeId}
                      isEditing={editingId === c.id}
                      editingTitle={editingTitle}
                      onSelect={() => {
                        setActiveId(c.id);
                        router.push("/app");
                      }}
                      onTogglePin={() => togglePin(c.id)}
                      onStartRename={(e) => handleStartRename(c, e)}
                      onSaveRename={() => handleSaveRename(c.id)}
                      onChangeEditingTitle={setEditingTitle}
                      onDelete={() => deleteConvo(c.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recents Section */}
          <div>
            <button
              type="button"
              onClick={() => setIsRecentsOpen(!isRecentsOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px",
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "#64748b",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
              }}
            >
              <span>Recents</span>
              <span style={{ fontSize: "9px" }}>{isRecentsOpen ? "▾" : "▸"}</span>
            </button>

            {isRecentsOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                {recentConversations.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conversation={c}
                    isActive={c.id === activeId}
                    isEditing={editingId === c.id}
                    editingTitle={editingTitle}
                    onSelect={() => {
                      setActiveId(c.id);
                      router.push("/app");
                    }}
                    onTogglePin={() => togglePin(c.id)}
                    onStartRename={(e) => handleStartRename(c, e)}
                    onSaveRename={() => handleSaveRename(c.id)}
                    onChangeEditingTitle={setEditingTitle}
                    onDelete={() => deleteConvo(c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Profile Bar */}
        <div
          style={{
            borderTop: "1px solid rgba(0, 0, 0, 0.08)",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255, 255, 255, 0.6)",
          }}
        >
          <div
            onClick={() => router.push("/app/profile")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              minWidth: 0,
              flex: 1,
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #4f46e5, #6366f1)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "4px", minWidth: 0 }}>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#0f172a",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userName}
              </span>
              <span style={{ fontSize: "11px", color: "#64748b" }}>· Enterprise ▾</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggle}
            title="Collapse sidebar"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              borderRadius: "4px",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Search Modal ── */}
      {isSearchOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "15vh",
          }}
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "560px",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.2)",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px 20px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                autoFocus
                type="text"
                placeholder="Search conversations & queries…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  fontSize: "15px",
                  color: "#0f172a",
                }}
              />
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ maxHeight: "360px", overflowY: "auto", padding: "10px" }}>
              {filteredSearchConversations.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  No matching chats found
                </div>
              ) : (
                filteredSearchConversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setActiveId(c.id);
                      setIsSearchOpen(false);
                      router.push("/app");
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "background 150ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <div style={{ fontSize: "13.5px", fontWeight: 500, color: "#0f172a" }}>
                        {c.title}
                      </div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                        {c.messages.length} messages · {new Date(c.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span style={{ fontSize: "12px", color: "#6366f1" }}>Open →</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Projects Modal ── */}
      {isProjectsOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setIsProjectsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "540px",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.2)",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>Projects & Workspaces</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                  Segment documents, retrieval scopes, and custom team prompts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProjectsOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { name: "Titan Core", desc: "Core RAG pipeline, algorithms, and engineering runbooks.", active: true, count: 48 },
                { name: "Odyssey", desc: "Product payment workflows, billing APIs, and customer specs.", active: false, count: 24 },
                { name: "Compliance & Security", desc: "SOC2 audits, secrets handling, and incident matrices.", active: false, count: 16 },
              ].map((proj) => (
                <div
                  key={proj.name}
                  style={{
                    padding: "14px 18px",
                    borderRadius: "12px",
                    border: proj.active ? "1.5px solid #6366f1" : "1px solid #e2e8f0",
                    background: proj.active ? "rgba(99, 102, 241, 0.04)" : "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>{proj.name}</span>
                      {proj.active && (
                        <span style={{ fontSize: "10px", background: "#4f46e5", color: "#fff", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>{proj.desc}</div>
                  </div>
                  <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>{proj.count} docs</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsProjectsOpen(false)}
              style={{
                marginTop: "20px",
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                background: "#4f46e5",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Customize Modal: Connectors & Plugins ── */}
      {isCustomizeOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0, 0, 0, 0.35)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setIsCustomizeOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "680px",
              maxHeight: "82vh",
              background: "#ffffff",
              borderRadius: "18px",
              boxShadow: "0 28px 70px rgba(0, 0, 0, 0.22)",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px 14px 24px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
                  Customize Workstation
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                  Add external connectors and activate reasoning plugins for your queries.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCustomizeOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: "24px",
                padding: "0 24px",
                borderBottom: "1px solid #f1f5f9",
                background: "#fafafa",
              }}
            >
              <button
                type="button"
                onClick={() => setCustomizeTab("connectors")}
                style={{
                  padding: "12px 4px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: customizeTab === "connectors" ? "#4f46e5" : "#64748b",
                  borderBottom: customizeTab === "connectors" ? "2px solid #4f46e5" : "2px solid transparent",
                }}
              >
                Data Connectors ({connectors.filter((c) => c.enabled).length}/{connectors.length})
              </button>
              <button
                type="button"
                onClick={() => setCustomizeTab("plugins")}
                style={{
                  padding: "12px 4px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: customizeTab === "plugins" ? "#4f46e5" : "#64748b",
                  borderBottom: customizeTab === "plugins" ? "2px solid #4f46e5" : "2px solid transparent",
                }}
              >
                Reasoning Plugins ({plugins.filter((p) => p.enabled).length}/{plugins.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {customizeTab === "connectors" ? (
                connectors.map((conn) => (
                  <div
                    key={conn.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: "12px",
                      border: conn.enabled ? "1px solid #c7d2fe" : "1px solid #e2e8f0",
                      background: conn.enabled ? "rgba(79, 70, 229, 0.02)" : "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: "24px" }}>{conn.icon}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>{conn.name}</span>
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              background: conn.status === "connected" ? "#dcfce7" : "#f1f5f9",
                              color: conn.status === "connected" ? "#166534" : "#64748b",
                              fontWeight: 500,
                            }}
                          >
                            {conn.status}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {conn.description}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleConnectorItem(conn.id)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        border: "none",
                        background: conn.enabled ? "#ef4444" : "#4f46e5",
                        color: "#ffffff",
                        transition: "all 150ms ease",
                      }}
                    >
                      {conn.enabled ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                ))
              ) : (
                plugins.map((plugin) => (
                  <div
                    key={plugin.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: "12px",
                      border: plugin.enabled ? "1px solid #c7d2fe" : "1px solid #e2e8f0",
                      background: plugin.enabled ? "rgba(79, 70, 229, 0.02)" : "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: "24px" }}>{plugin.icon}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>{plugin.name}</span>
                          <span style={{ fontSize: "10px", color: "#64748b", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>
                            v{plugin.version}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          {plugin.description}
                        </div>
                      </div>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={plugin.enabled}
                        onChange={() => togglePluginItem(plugin.id)}
                        style={{ width: "16px", height: "16px", accentColor: "#4f46e5" }}
                      />
                    </label>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "12px 24px",
                borderTop: "1px solid #f1f5f9",
                background: "#fafafa",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setIsCustomizeOpen(false)}
                style={{
                  padding: "7px 16px",
                  borderRadius: "8px",
                  background: "#4f46e5",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Save & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Individual Conversation Row
   ───────────────────────────────────────────────────────────────────────────── */

function ConversationRow({
  conversation,
  isActive,
  isEditing,
  editingTitle,
  onSelect,
  onTogglePin,
  onStartRename,
  onSaveRename,
  onChangeEditingTitle,
  onDelete,
}: {
  conversation: Conversation;
  isActive: boolean;
  isEditing: boolean;
  editingTitle: string;
  onSelect: () => void;
  onTogglePin: () => void;
  onStartRename: (e: React.MouseEvent) => void;
  onSaveRename: () => void;
  onChangeEditingTitle: (v: string) => void;
  onDelete: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsMenuOpen(false);
      }}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "7px 10px",
        borderRadius: "8px",
        cursor: "pointer",
        background: isActive
          ? "rgba(79, 70, 229, 0.08)"
          : isHovered
          ? "rgba(0, 0, 0, 0.035)"
          : "transparent",
        color: isActive ? "#4f46e5" : "#334155",
        fontSize: "13px",
        fontWeight: isActive ? 600 : 400,
        transition: "all 140ms ease",
      }}
    >
      {/* Title / Edit input */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={editingTitle}
            onChange={(e) => onChangeEditingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveRename();
              if (e.key === "Escape") onSaveRename();
            }}
            onBlur={onSaveRename}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              padding: "2px 4px",
              fontSize: "12.5px",
              border: "1px solid #4f46e5",
              borderRadius: "4px",
              outline: "none",
              color: "#0f172a",
            }}
          />
        ) : (
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "13px",
            }}
          >
            {conversation.title}
          </span>
        )}
      </div>

      {/* Right side: document icon or hover actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0, marginLeft: "6px" }}>
        {/* Document icon indicator matching the reference screenshot */}
        {!isHovered && !isMenuOpen && (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}

        {/* Hover action menu trigger */}
        {(isHovered || isMenuOpen) && (
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            {/* Pin / unpin button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              title={conversation.pinned ? "Unpin" : "Pin"}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px 4px",
                color: conversation.pinned ? "#4f46e5" : "#64748b",
                borderRadius: "4px",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill={conversation.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
              </svg>
            </button>

            {/* Menu options button (...) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px 4px",
                color: "#64748b",
                borderRadius: "4px",
              }}
            >
              ···
            </button>
          </div>
        )}
      </div>

      {/* Floating Options Menu */}
      {isMenuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "100%",
            right: "4px",
            background: "#ffffff",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)",
            padding: "4px",
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            minWidth: "120px",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              setIsMenuOpen(false);
              onStartRename(e);
            }}
            style={{
              padding: "6px 10px",
              fontSize: "12px",
              color: "#334155",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              textAlign: "left",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              onTogglePin();
            }}
            style={{
              padding: "6px 10px",
              fontSize: "12px",
              color: "#334155",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              textAlign: "left",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {conversation.pinned ? "Unpin" : "Pin"}
          </button>
          <div style={{ height: "1px", background: "#f1f5f9", margin: "3px 0" }} />
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              onDelete();
            }}
            style={{
              padding: "6px 10px",
              fontSize: "12px",
              color: "#ef4444",
              background: "transparent",
              border: "none",
              borderRadius: "4px",
              textAlign: "left",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default ClaudeSidebar;
