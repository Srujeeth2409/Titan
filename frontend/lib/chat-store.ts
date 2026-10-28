"use client";

import { useEffect, useState } from "react";
import { Citation, Confidence, HallucinationInfo } from "@/components/ask-box";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  citations?: Citation[];
  confidence?: Confidence;
  hallucination?: HallucinationInfo;
  steps?: { step: string; status: "started" | "completed" }[];
  abstention?: {
    found: string[];
    missing: string;
    suggested_documents: string[];
  };
  error?: { message: string; code?: string; traceId?: string };
  model?: string;
  collection?: string;
  exportAttachment?: {
    format: "pdf" | "docx" | "both";
    title: string;
    targetContent: string;
    citations?: Citation[];
    confidence?: Confidence;
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  project?: string;
  messages: ChatMessage[];
}

export interface Connector {
  id: string;
  name: string;
  description: string;
  category: "cloud" | "workspace" | "developer";
  icon: string;
  enabled: boolean;
  status: "connected" | "disconnected" | "syncing";
  lastSync?: string;
  documentsCount?: number;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  category: "tool" | "reasoning" | "data";
  icon: string;
  enabled: boolean;
  author: string;
  version: string;
}

const STORAGE_CONVERSATIONS_KEY = "titan_conversations_v1";
const STORAGE_ACTIVE_ID_KEY = "titan_active_convo_id_v1";
const STORAGE_CONNECTORS_KEY = "titan_connectors_v1";
const STORAGE_PLUGINS_KEY = "titan_plugins_v1";

const DEFAULT_CONNECTORS: Connector[] = [
  {
    id: "gdrive",
    name: "Google Drive",
    description: "Sync docs, sheets, slides, and shared team drives automatically.",
    category: "cloud",
    icon: "📁",
    enabled: true,
    status: "connected",
    lastSync: "10 mins ago",
    documentsCount: 42,
  },
  {
    id: "notion",
    name: "Notion",
    description: "Index engineering wikis, product specs, and company handbooks.",
    category: "workspace",
    icon: "📓",
    enabled: true,
    status: "connected",
    lastSync: "1 hour ago",
    documentsCount: 18,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Ingest incident channels, resolution threads, and team announcements.",
    category: "workspace",
    icon: "💬",
    enabled: false,
    status: "disconnected",
  },
  {
    id: "github",
    name: "GitHub Repositories",
    description: "Index architecture markdown, READMEs, pull request RFCs, and codebases.",
    category: "developer",
    icon: "🐙",
    enabled: true,
    status: "connected",
    lastSync: "3 hours ago",
    documentsCount: 89,
  },
  {
    id: "confluence",
    name: "Confluence",
    description: "Connect enterprise knowledge spaces, runbooks, and SOP documents.",
    category: "workspace",
    icon: "📘",
    enabled: false,
    status: "disconnected",
  },
  {
    id: "s3",
    name: "Amazon S3",
    description: "Bucket ingestion for enterprise PDF archives, CSVs, and parquet dumps.",
    category: "cloud",
    icon: "🪣",
    enabled: false,
    status: "disconnected",
  },
];

const DEFAULT_PLUGINS: Plugin[] = [
  {
    id: "web-search",
    name: "Live Web Search",
    description: "Enrich enterprise answers with real-time web citations and latest documentation.",
    category: "tool",
    icon: "🌐",
    enabled: true,
    author: "Titan AI",
    version: "2.4.0",
  },
  {
    id: "code-interpreter",
    name: "Python Code Interpreter",
    description: "Execute Python scripts in a secure sandbox to calculate metrics and plot charts.",
    category: "data",
    icon: "🐍",
    enabled: true,
    author: "Titan Sandbox",
    version: "1.8.2",
  },
  {
    id: "data-analyst",
    name: "CSV & Tabular Analyst",
    description: "Perform SQL queries and aggregations across uploaded spreadsheet corpora.",
    category: "data",
    icon: "📊",
    enabled: true,
    author: "Titan Data",
    version: "1.1.0",
  },
  {
    id: "arxiv-search",
    name: "ArXiv Research Scanner",
    description: "Search and ground answers in 2M+ peer-reviewed scientific papers.",
    category: "reasoning",
    icon: "📑",
    enabled: false,
    author: "Community",
    version: "0.9.4",
  },
];

const INITIAL_RECENT_CHATS: Conversation[] = [
  {
    id: "convo-1",
    title: "Vercel app deployment",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    pinned: true,
    project: "Titan",
    messages: [
      {
        id: "msg-1-1",
        role: "user",
        content: "What is the recommended multi-stage Docker build strategy for our Next.js frontend deployed to production?",
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: "msg-1-2",
        role: "assistant",
        content: "Our production deployment utilizes a 3-stage alpine Dockerfile:\n\n1. **`deps` Stage**: Installs production dependencies and caches `node_modules`.\n2. **`builder` Stage**: Copies application source and compiles the static chunks with `npm run build`.\n3. **`runner` Stage**: Copies only `.next/standalone`, `.next/static`, and `public` assets to achieve a minimal ~85MB container footprint.\n\nThis ensures fast container spin-up times and zero leak of devDependencies into production.",
        createdAt: new Date(Date.now() - 3600000 * 2 + 5000).toISOString(),
        confidence: { composite: 0.94, retrieval: 0.96, citation_coverage: 1.0, completeness: 0.92 },
        hallucination: { score: 0.02, total_claims: 3, unsupported_claims: [] },
        citations: [
          {
            index: 1,
            chunk_id: "chk-deploy-01",
            source: "Deployment-Runbook.md",
            section: "Docker Build Pipeline",
            verdict: "supported",
            snippet: "The standalone Next.js output mode packages only necessary node_modules, drastically reducing cold start latency.",
          },
        ],
      },
    ],
  },
  {
    id: "convo-2",
    title: "Bill payment app architecture",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    pinned: true,
    project: "Odyssey",
    messages: [
      {
        id: "msg-2-1",
        role: "user",
        content: "Explain our idempotency key mechanism for payment processing endpoints.",
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: "msg-2-2",
        role: "assistant",
        content: "Payment requests enforce an `Idempotency-Key` header stored in Redis with a 24-hour TTL:\n\n- When a request arrives, Redis atomically checks `SETNX idempotency:{key} 'processing'`.\n- If the key exists, subsequent duplicate attempts return the cached transaction response.\n- This prevents double charging even during network retries or client double-clicks.",
        createdAt: new Date(Date.now() - 3600000 * 5 + 4000).toISOString(),
        confidence: { composite: 0.97, retrieval: 0.98, citation_coverage: 0.95 },
      },
    ],
  },
  {
    id: "convo-3",
    title: "Hybrid retrieval ranking & BM25",
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    pinned: false,
    project: "Titan",
    messages: [],
  },
  {
    id: "convo-4",
    title: "Power BI project ideas for 2026",
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    pinned: false,
    messages: [],
  },
  {
    id: "convo-5",
    title: "Project management exam answers",
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    pinned: false,
    messages: [],
  },
  {
    id: "convo-6",
    title: "Ingestion module file types",
    createdAt: new Date(Date.now() - 3600000 * 96).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 96).toISOString(),
    pinned: false,
    messages: [],
  },
];

export function getStoredConversations(): Conversation[] {
  if (typeof window === "undefined") return INITIAL_RECENT_CHATS;
  try {
    const raw = localStorage.getItem(STORAGE_CONVERSATIONS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_CONVERSATIONS_KEY, JSON.stringify(INITIAL_RECENT_CHATS));
      return INITIAL_RECENT_CHATS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_RECENT_CHATS;
  }
}

export function saveStoredConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_CONVERSATIONS_KEY, JSON.stringify(conversations));
    window.dispatchEvent(new CustomEvent("titan:chat-updated"));
  } catch (e) {
    console.error("Failed saving conversations:", e);
  }
}

export function getActiveConversationId(): string {
  if (typeof window === "undefined") return "convo-1";
  try {
    const id = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);
    return id || "convo-1";
  } catch {
    return "convo-1";
  }
}

export function setActiveConversationId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_ACTIVE_ID_KEY, id);
    window.dispatchEvent(new CustomEvent("titan:conversation-switched", { detail: { id } }));
  } catch (e) {
    console.error("Failed setting active conversation:", e);
  }
}

export function createNewConversation(initialTitle = "New Chat"): Conversation {
  const newConvo: Conversation = {
    id: `convo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: initialTitle,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pinned: false,
    project: "Titan",
    messages: [],
  };
  const list = getStoredConversations();
  const updated = [newConvo, ...list];
  saveStoredConversations(updated);
  setActiveConversationId(newConvo.id);
  return newConvo;
}

export function togglePinConversation(id: string): void {
  const list = getStoredConversations();
  const updated = list.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c));
  saveStoredConversations(updated);
}

export function renameConversation(id: string, newTitle: string): void {
  const list = getStoredConversations();
  const updated = list.map((c) => (c.id === id ? { ...c, title: newTitle, updatedAt: new Date().toISOString() } : c));
  saveStoredConversations(updated);
}

export function deleteConversation(id: string): void {
  const list = getStoredConversations();
  const filtered = list.filter((c) => c.id !== id);
  saveStoredConversations(filtered);
  const activeId = getActiveConversationId();
  if (activeId === id) {
    if (filtered.length > 0) {
      setActiveConversationId(filtered[0].id);
    } else {
      createNewConversation();
    }
  }
}

export function rollbackToMessage(convoId: string, messageId: string): string {
  const list = getStoredConversations();
  const convo = list.find((c) => c.id === convoId);
  if (!convo) return "";

  const idx = convo.messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return "";

  const targetMsg = convo.messages[idx];
  // Retain messages up to before this message, so user can re-prompt
  const remaining = convo.messages.slice(0, idx);
  const updated = list.map((c) =>
    c.id === convoId ? { ...c, messages: remaining, updatedAt: new Date().toISOString() } : c
  );
  saveStoredConversations(updated);
  return targetMsg.content;
}

export function getStoredConnectors(): Connector[] {
  if (typeof window === "undefined") return DEFAULT_CONNECTORS;
  try {
    const raw = localStorage.getItem(STORAGE_CONNECTORS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CONNECTORS;
  } catch {
    return DEFAULT_CONNECTORS;
  }
}

export function toggleConnector(id: string): Connector[] {
  const current = getStoredConnectors();
  const updated = current.map((c) =>
    c.id === id ? { ...c, enabled: !c.enabled, status: (!c.enabled ? "connected" : "disconnected") as any } : c
  );
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_CONNECTORS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("titan:connectors-updated"));
  }
  return updated;
}

export function getStoredPlugins(): Plugin[] {
  if (typeof window === "undefined") return DEFAULT_PLUGINS;
  try {
    const raw = localStorage.getItem(STORAGE_PLUGINS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_PLUGINS;
  } catch {
    return DEFAULT_PLUGINS;
  }
}

export function togglePlugin(id: string): Plugin[] {
  const current = getStoredPlugins();
  const updated = current.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_PLUGINS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("titan:plugins-updated"));
  }
  return updated;
}

export function useChatStore() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveIdState] = useState<string>("");
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);

  useEffect(() => {
    setConversations(getStoredConversations());
    setActiveIdState(getActiveConversationId());
    setConnectors(getStoredConnectors());
    setPlugins(getStoredPlugins());

    const handleUpdate = () => {
      setConversations(getStoredConversations());
      setActiveIdState(getActiveConversationId());
      setConnectors(getStoredConnectors());
      setPlugins(getStoredPlugins());
    };

    window.addEventListener("titan:chat-updated", handleUpdate);
    window.addEventListener("titan:conversation-switched", handleUpdate);
    window.addEventListener("titan:connectors-updated", handleUpdate);
    window.addEventListener("titan:plugins-updated", handleUpdate);

    return () => {
      window.removeEventListener("titan:chat-updated", handleUpdate);
      window.removeEventListener("titan:conversation-switched", handleUpdate);
      window.removeEventListener("titan:connectors-updated", handleUpdate);
      window.removeEventListener("titan:plugins-updated", handleUpdate);
    };
  }, []);

  const activeConversation =
    conversations.find((c) => c.id === activeId) ||
    conversations[0] ||
    null;

  return {
    conversations,
    activeId,
    activeConversation,
    connectors,
    plugins,
    setActiveId: (id: string) => setActiveConversationId(id),
    createNew: () => createNewConversation(),
    togglePin: (id: string) => togglePinConversation(id),
    rename: (id: string, title: string) => renameConversation(id, title),
    deleteConvo: (id: string) => deleteConversation(id),
    rollback: (convoId: string, messageId: string) => rollbackToMessage(convoId, messageId),
    toggleConnectorItem: (id: string) => setConnectors(toggleConnector(id)),
    togglePluginItem: (id: string) => setPlugins(togglePlugin(id)),
  };
}
