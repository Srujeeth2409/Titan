"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  useChatStore,
  ChatMessage,
  saveStoredConversations,
  getStoredConversations,
} from "@/lib/chat-store";
import { askStream, getDocuments, TitanApiError } from "@/lib/api";
import { Citation, Confidence, HallucinationInfo } from "@/components/ask-box";
import {
  exportToPdf,
  exportToDocx,
  detectExportIntent,
} from "@/lib/document-exporter";

export function ChatConversation({
  isSidebarOpen,
  onToggleSidebar,
}: {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const {
    activeConversation,
    activeId,
    setActiveId,
    createNew,
    rollback,
    rename,
    deleteConvo,
  } = useChatStore();

  const [inputQuery, setInputQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState("Ollama (Local 1.5B)");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"Fast" | "Medium" | "Deep">("Medium");
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  // Collections
  const [collection, setCollection] = useState("default");
  const [collections, setCollections] = useState<string[]>(["default"]);
  const [isCollectionPickerOpen, setIsCollectionPickerOpen] = useState(false);

  // Voice
  const [isListening, setIsListening] = useState(false);

  // Streaming State
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingSteps, setStreamingSteps] = useState<{ step: string; status: "started" | "completed" }[]>([]);
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [streamingConfidence, setStreamingConfidence] = useState<Confidence | null>(null);
  const [streamingHallucination, setStreamingHallucination] = useState<HallucinationInfo | null>(null);
  const [streamingError, setStreamingError] = useState<{ message: string; code?: string } | null>(null);

  // Active citation preview drawer
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  // Copied toast state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // Rename title state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const models = [
    { id: "qwen2.5:1.5b", name: "Ollama (Local 1.5B)", tier: "Local 1.5B", provider: "ollama" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", tier: "Strong", provider: "anthropic" },
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Groq)", tier: "Fast & Free", provider: "groq" },
    { id: "qwen-2.5-32b", name: "Qwen 2.5 32B (Groq)", tier: "Fast", provider: "groq" },
    { id: "gpt-4o", name: "GPT-4o (OpenAI)", tier: "Strong", provider: "openai" },
    { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (OpenRouter)", tier: "Free Tier", provider: "openrouter" },
  ];

  const modes = [
    { id: "Fast", label: "⚡ Fast (Single)", desc: "Quick answer without multi-step decomposition" },
    { id: "Medium", label: "📊 Medium (Hybrid)", desc: "Dense Qdrant + Sparse retrieval with rerank" },
    { id: "Deep", label: "🧠 Deep (Agentic)", desc: "Multi-step reasoning and full source verification" },
  ];

  // Auto-scroll to bottom as answer streams
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, streamingAnswer, isStreaming]);

  // Load available collections
  useEffect(() => {
    async function loadCollections() {
      try {
        const res = await getDocuments();
        if (res?.documents && Array.isArray(res.documents)) {
          const uniqueCols = Array.from(new Set(res.documents.map((d: any) => d.collection || "default"))) as string[];
          if (uniqueCols.length > 0) {
            setCollections(uniqueCols);
            setCollection(uniqueCols[0]);
          }
        }
      } catch {}
    }
    loadCollections();
  }, []);

  // Voice Web Speech API
  const toggleVoice = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      try {
        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputQuery((prev) => (prev ? prev + " " + transcript : transcript));
          setIsListening(false);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
        return;
      } catch {}
    }
    setIsListening(false);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Rollback prompt: replaces input query with that prompt and removes subsequent messages
  const handleRollback = (msg: ChatMessage) => {
    if (!activeConversation) return;
    const rolledPrompt = rollback(activeConversation.id, msg.id);
    setInputQuery(rolledPrompt || msg.content);
    textareaRef.current?.focus();
  };

  // Export specific message helper
  const handleExportMessage = async (msg: ChatMessage, format: "pdf" | "docx") => {
    const docTitle = activeConversation?.title || "Titan_Knowledge_Synthesis";
    setDownloadingDocId(`${format}-${msg.id}`);
    try {
      if (format === "pdf") {
        await exportToPdf({
          title: docTitle,
          content: msg.content,
          citations: msg.citations,
          confidence: msg.confidence,
          model: msg.model || selectedModel,
          collection: msg.collection || collection,
        });
      } else {
        await exportToDocx({
          title: docTitle,
          content: msg.content,
          citations: msg.citations,
          confidence: msg.confidence,
          model: msg.model || selectedModel,
          collection: msg.collection || collection,
        });
      }
    } catch (e) {
      console.error(`Export to ${format} failed:`, e);
    } finally {
      setTimeout(() => setDownloadingDocId(null), 1000);
    }
  };

  // Send query & stream answer into conversation thread
  const handleSendQuery = async (customQuery?: string) => {
    const query = (customQuery || inputQuery).trim();
    if (!query || isStreaming || !activeConversation) return;

    const currentConvo = activeConversation;
    const isFirstMessage = currentConvo.messages.length === 0;
    const autoTitle = isFirstMessage
      ? query.slice(0, 42) + (query.length > 42 ? "…" : "")
      : currentConvo.title;

    // 1. Append user message to active conversation
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
      model: selectedModel,
      collection,
    };

    const allConvos = getStoredConversations();

    // ── Check for document export intent (e.g. "download this as a pdf", "give my above response as a word document") ──
    const exportIntent = detectExportIntent(query);
    const lastAssistantMsg = [...currentConvo.messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content && !m.exportAttachment);

    if (exportIntent.isExport && lastAssistantMsg) {
      const docTitle = currentConvo.title === "New Chat" ? "Titan_Document" : currentConvo.title;

      // Automatically trigger client-side download in requested format
      try {
        if (exportIntent.format === "pdf" || exportIntent.format === "both") {
          exportToPdf({
            title: docTitle,
            content: lastAssistantMsg.content,
            citations: lastAssistantMsg.citations,
            confidence: lastAssistantMsg.confidence,
            model: lastAssistantMsg.model || selectedModel,
            collection: lastAssistantMsg.collection || collection,
          });
        }
        if (exportIntent.format === "docx" || exportIntent.format === "both") {
          exportToDocx({
            title: docTitle,
            content: lastAssistantMsg.content,
            citations: lastAssistantMsg.citations,
            confidence: lastAssistantMsg.confidence,
            model: lastAssistantMsg.model || selectedModel,
            collection: lastAssistantMsg.collection || collection,
          });
        }
      } catch (e) {
        console.error("Auto export error:", e);
      }

      const formatLabel =
        exportIntent.format === "both"
          ? "PDF and Microsoft Word (.docx)"
          : exportIntent.format === "pdf"
          ? "PDF"
          : "Microsoft Word (.docx)";

      const assistantExportMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: `I have compiled your response into a **${formatLabel}** document. The download has started automatically in your browser.\n\nYou can also click the download cards below to save additional copies anytime:`,
        createdAt: new Date().toISOString(),
        model: selectedModel,
        collection,
        citations: lastAssistantMsg.citations,
        confidence: lastAssistantMsg.confidence,
        exportAttachment: {
          format: exportIntent.format,
          title: docTitle,
          targetContent: lastAssistantMsg.content,
          citations: lastAssistantMsg.citations,
          confidence: lastAssistantMsg.confidence,
        },
      };

      const updatedConvoWithExport = {
        ...currentConvo,
        messages: [...currentConvo.messages, userMsg, assistantExportMsg],
        updatedAt: new Date().toISOString(),
      };

      saveStoredConversations(
        allConvos.map((c) => (c.id === currentConvo.id ? updatedConvoWithExport : c))
      );

      setInputQuery("");
      return;
    }

    // ── Standard RAG Retrieval Path ──
    const updatedConvoWithUser = {
      ...currentConvo,
      title: currentConvo.title === "New Chat" ? autoTitle : currentConvo.title,
      messages: [...currentConvo.messages, userMsg],
      updatedAt: new Date().toISOString(),
    };

    saveStoredConversations(
      allConvos.map((c) => (c.id === currentConvo.id ? updatedConvoWithUser : c))
    );

    setInputQuery("");
    setIsStreaming(true);
    setStreamingAnswer("");
    setStreamingSteps([{ step: "Query analysis & embedding generation", status: "started" }]);
    setStreamingCitations([]);
    setStreamingConfidence(null);
    setStreamingHallucination(null);
    setStreamingError(null);

    const apiMode = selectedMode === "Fast" ? "single" : selectedMode === "Deep" ? "agentic" : "auto";
    const selectedModelObj = models.find((m) => m.name === selectedModel);

    let accumulatedAnswer = "";
    let finalCitations: Citation[] = [];
    let finalConfidence: Confidence | null = null;
    let finalHallucination: HallucinationInfo | null = null;
    let finalSteps: { step: string; status: "started" | "completed" }[] = [
      { step: "Query analysis & embedding generation", status: "started" },
    ];
    let finalError: { message: string; code?: string } | null = null;

    try {
      const response = await askStream(
        query,
        collection,
        apiMode,
        selectedModelObj?.provider,
        selectedModelObj?.id
      );

      if (!response.ok) {
        let errMessage = "Could not reach retrieval gateway.";
        let errCode = `HTTP-${response.status}`;
        try {
          const body = await response.json();
          if (body?.detail) {
            errMessage = typeof body.detail === "string" ? body.detail : body.detail.message || JSON.stringify(body.detail);
            errCode = body.detail.code || errCode;
          }
        } catch {}
        throw new TitanApiError(response.status, { code: errCode, message: errMessage, trace_id: "" });
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream reader not available.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, "");
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            const eventType = event.type || event.event;
            const data = event.data || event;

            if (eventType === "step_started") {
              finalSteps = [...finalSteps, { step: data.step || "Retrieval", status: "started" }];
              setStreamingSteps([...finalSteps]);
            } else if (eventType === "step_completed") {
              finalSteps = finalSteps.map((s) =>
                s.step === (data.step || s.step) ? { ...s, status: "completed" } : s
              );
              setStreamingSteps([...finalSteps]);
            } else if (eventType === "token") {
              const token = data.token || data.text || "";
              accumulatedAnswer += token;
              setStreamingAnswer(accumulatedAnswer);
            } else if (eventType === "answer_final") {
              if (data.answer) {
                accumulatedAnswer = data.answer;
                setStreamingAnswer(accumulatedAnswer);
              }
              if (data.citations) {
                finalCitations = data.citations;
                setStreamingCitations(finalCitations);
              }
              if (data.confidence) {
                finalConfidence = data.confidence;
                setStreamingConfidence(finalConfidence);
              }
              if (data.hallucination) {
                finalHallucination = data.hallucination;
                setStreamingHallucination(finalHallucination);
              }
            } else if (eventType === "error") {
              finalError = { message: data.message || "An error occurred during query execution.", code: data.code };
              setStreamingError(finalError);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      finalError = { message: err.message || "Failed to execute query against Titan backend." };
      setStreamingError(finalError);
    } finally {
      setIsStreaming(false);
      finalSteps = finalSteps.map((s) => ({ ...s, status: "completed" }));

      // Append ONLY assistant message to active conversation (userMsg was already appended above)
      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: accumulatedAnswer || (finalError ? finalError.message : "No answer returned."),
        createdAt: new Date().toISOString(),
        citations: finalCitations,
        confidence: finalConfidence || undefined,
        hallucination: finalHallucination || undefined,
        steps: finalSteps,
        error: finalError || undefined,
        model: selectedModel,
        collection,
      };

      const convos = getStoredConversations();
      saveStoredConversations(
        convos.map((c) =>
          c.id === currentConvo.id
            ? {
                ...c,
                messages: [...c.messages, assistantMsg],
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );

      setStreamingAnswer("");
      setStreamingSteps([]);
    }
  };

  const messages = activeConversation?.messages || [];
  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        minHeight: "calc(100vh - 185px)",
        marginLeft: isSidebarOpen ? "272px" : "0",
        transition: "margin-left 260ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* ── Conversation Header Bar (when chat has messages) ── */}
      {hasMessages && (
        <div
          style={{
            position: "sticky",
            top: "68px",
            zIndex: 25,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 24px",
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            {/* Sidebar toggle button inside chat */}
            <button
              type="button"
              onClick={onToggleSidebar}
              title="Toggle sidebar"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "6px",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#0f172a")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>

            {/* Editable Title */}
            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={() => {
                  if (titleInput.trim() && activeConversation) {
                    rename(activeConversation.id, titleInput.trim());
                  }
                  setIsEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (titleInput.trim() && activeConversation) {
                      rename(activeConversation.id, titleInput.trim());
                    }
                    setIsEditingTitle(false);
                  }
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#0f172a",
                  border: "1px solid #4f46e5",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  outline: "none",
                }}
              />
            ) : (
              <div
                onClick={() => {
                  if (activeConversation) {
                    setTitleInput(activeConversation.title);
                    setIsEditingTitle(true);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#0f172a",
                }}
                title="Click to rename chat"
              >
                <span>{activeConversation?.title || "Conversation"}</span>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>✎</span>
              </div>
            )}

            {/* Collection tag */}
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#4f46e5",
                background: "rgba(79, 70, 229, 0.08)",
                padding: "2px 8px",
                borderRadius: "6px",
              }}
            >
              Collection: {collection}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* + New Chat shortcut */}
            <button
              type="button"
              onClick={() => createNew()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                transition: "all 140ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e2e8f0")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f1f5f9")}
            >
              <span>+</span>
              <span>New</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Main Chat Area ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: hasMessages ? "flex-start" : "center",
          width: "100%",
          padding: hasMessages ? "24px 24px 140px 24px" : "40px 24px 80px 24px",
        }}
      >
        {!hasMessages ? (
          /* ── Empty State / Initial Hero View ── */
          <section
            data-grid-avoid
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              maxWidth: "760px",
              width: "100%",
            }}
          >
            {/* Enterprise RAG Pill Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 16px",
                borderRadius: "999px",
                background: "rgba(79, 70, 229, 0.08)",
                border: "1px solid rgba(79, 70, 229, 0.16)",
                marginBottom: "24px",
                fontSize: "12px",
                fontWeight: 500,
                color: "#4f46e5",
                letterSpacing: "0.02em",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#4f46e5",
                  boxShadow: "0 0 8px rgba(79, 70, 229, 0.5)",
                  display: "inline-block",
                }}
              />
              Internal Knowledge Synthesis & Citation Grounding
            </div>

            <h1
              style={{
                fontSize: "clamp(2.2rem, 4.5vw, 3.25rem)",
                fontWeight: 700,
                letterSpacing: "-0.035em",
                lineHeight: 1.15,
                color: "#0f172a",
                marginBottom: "14px",
              }}
            >
              What do you want to know?
            </h1>
            <p
              style={{
                fontSize: "16px",
                color: "#64748b",
                maxWidth: "540px",
                lineHeight: 1.6,
                marginBottom: "36px",
              }}
            >
              Ask questions across your enterprise documents. Every answer is backed by source passages with verified claim citations.
            </p>

            {/* Centered Input Box */}
            <div style={{ width: "100%", maxWidth: "660px" }}>
              <ChatInputBar
                query={inputQuery}
                setQuery={setInputQuery}
                onSend={handleSendQuery}
                isStreaming={isStreaming}
                models={models}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                modes={modes}
                selectedMode={selectedMode}
                setSelectedMode={setSelectedMode}
                collections={collections}
                collection={collection}
                setCollection={setCollection}
                isListening={isListening}
                toggleVoice={toggleVoice}
                textareaRef={textareaRef}
              />
            </div>
          </section>
        ) : (
          /* ── Multi-Turn Conversation History ── */
          <div
            style={{
              width: "100%",
              maxWidth: "820px",
              display: "flex",
              flexDirection: "column",
              gap: "28px",
            }}
          >
            {messages.map((msg, index) => (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {msg.role === "user" ? (
                  /* ── User Message Row ── */
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "85%",
                        background: "#ffffff",
                        border: "1px solid rgba(0, 0, 0, 0.08)",
                        borderRadius: "18px 18px 4px 18px",
                        padding: "14px 18px",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "15px",
                          lineHeight: 1.6,
                          color: "#0f172a",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {msg.content}
                      </div>

                      {/* User Message Actions: Rollback / Edit & Copy */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: "10px",
                          paddingTop: "4px",
                          borderTop: "1px solid rgba(0, 0, 0, 0.04)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleRollback(msg)}
                          title="Rollback to this query and edit next"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#64748b",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#4f46e5")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                        >
                          <span>↺</span>
                          <span>Rollback & Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopy(msg.content, msg.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#64748b",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#0f172a")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                        >
                          {copiedId === msg.id ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Assistant Message Row ── */
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "14px",
                      width: "100%",
                    }}
                  >
                    {/* Titan Brand Avatar */}
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #4f46e5, #6366f1, #3b82f6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 8px rgba(79, 70, 229, 0.25)",
                        flexShrink: 0,
                        marginTop: "2px",
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="#fff" strokeWidth="2.5">
                        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                      </svg>
                    </div>

                    <div
                      style={{
                        flex: 1,
                        background: "rgba(255, 255, 255, 0.9)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        border: "1px solid rgba(0, 0, 0, 0.08)",
                        borderRadius: "18px",
                        padding: "20px 24px",
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                      }}
                    >
                      {/* Step badges */}
                      {msg.steps && msg.steps.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {msg.steps.map((st, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 500,
                                color: "#475569",
                                background: "#f1f5f9",
                                padding: "2px 8px",
                                borderRadius: "6px",
                              }}
                            >
                              ✓ {st.step}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Markdown Answer Body */}
                      <div
                        style={{
                          fontSize: "14.5px",
                          lineHeight: 1.7,
                          color: "#0f172a",
                          whiteSpace: "pre-line",
                        }}
                      >
                        {msg.content}
                      </div>

                      {/* Interactive Export Document Card (when generated via prompt) */}
                      {msg.exportAttachment && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "14px 18px",
                            borderRadius: "12px",
                            background: "linear-gradient(135deg, rgba(79, 70, 229, 0.05), rgba(59, 130, 246, 0.05))",
                            border: "1px solid rgba(79, 70, 229, 0.22)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "12px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div
                              style={{
                                width: "42px",
                                height: "42px",
                                borderRadius: "10px",
                                background: msg.exportAttachment.format === "docx" ? "#2563eb" : "#ef4444",
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "20px",
                                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                              }}
                            >
                              {msg.exportAttachment.format === "docx" ? "📝" : "📄"}
                            </div>
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>
                                {msg.exportAttachment.title}.{msg.exportAttachment.format === "docx" ? "docx" : "pdf"}
                              </div>
                              <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                                Formatted Document • Verified against {msg.exportAttachment.citations?.length || 0} citations
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "8px" }}>
                            {(msg.exportAttachment.format === "pdf" || msg.exportAttachment.format === "both") && (
                              <button
                                type="button"
                                onClick={() =>
                                  exportToPdf({
                                    title: msg.exportAttachment!.title,
                                    content: msg.exportAttachment!.targetContent,
                                    citations: msg.exportAttachment!.citations,
                                    confidence: msg.exportAttachment!.confidence,
                                    model: msg.model || selectedModel,
                                    collection: msg.collection || collection,
                                  })
                                }
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: "8px",
                                  background: "#4f46e5",
                                  color: "#ffffff",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  border: "none",
                                  cursor: "pointer",
                                  boxShadow: "0 2px 6px rgba(79, 70, 229, 0.25)",
                                }}
                              >
                                📥 Download PDF
                              </button>
                            )}

                            {(msg.exportAttachment.format === "docx" || msg.exportAttachment.format === "both") && (
                              <button
                                type="button"
                                onClick={() =>
                                  exportToDocx({
                                    title: msg.exportAttachment!.title,
                                    content: msg.exportAttachment!.targetContent,
                                    citations: msg.exportAttachment!.citations,
                                    confidence: msg.exportAttachment!.confidence,
                                    model: msg.model || selectedModel,
                                    collection: msg.collection || collection,
                                  })
                                }
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: "8px",
                                  background: "#2563eb",
                                  color: "#ffffff",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  border: "none",
                                  cursor: "pointer",
                                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                                }}
                              >
                                📥 Download Word (.docx)
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Interactive Citation Chips */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                          <div
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              color: "#64748b",
                              marginBottom: "8px",
                            }}
                          >
                            Verified Grounding Passages ({msg.citations.length})
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {msg.citations.map((c, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setSelectedCitation(c)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "5px 10px",
                                  borderRadius: "8px",
                                  background: "#ffffff",
                                  border: "1px solid #cbd5e1",
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  color: "#334155",
                                  cursor: "pointer",
                                  transition: "all 140ms ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = "#4f46e5";
                                  e.currentTarget.style.color = "#4f46e5";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = "#cbd5e1";
                                  e.currentTarget.style.color = "#334155";
                                }}
                              >
                                <span style={{ fontWeight: 700, color: "#4f46e5" }}>[{c.index || i + 1}]</span>
                                <span>{c.source}</span>
                                {c.section && <span style={{ color: "#64748b" }}>· {c.section}</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Verification / Confidence Footer & Document Download Buttons */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingTop: "8px",
                          borderTop: "1px solid rgba(0, 0, 0, 0.04)",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "#166534",
                              background: "#dcfce7",
                              padding: "2px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            ✓ Verified Grounded
                          </span>
                          {msg.confidence?.composite !== undefined && (
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              {Math.round(msg.confidence.composite * 100)}% Confidence
                            </span>
                          )}
                        </div>

                        {/* Action buttons: Download PDF, Download Word, Copy */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {/* Export as PDF */}
                          <button
                            type="button"
                            onClick={() => handleExportMessage(msg, "pdf")}
                            title="Download this answer as a formatted PDF"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              background: "transparent",
                              border: "1px solid rgba(0, 0, 0, 0.1)",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              color: "#334155",
                              fontSize: "11.5px",
                              fontWeight: 500,
                              cursor: "pointer",
                              transition: "all 140ms ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#f1f5f9";
                              e.currentTarget.style.borderColor = "#4f46e5";
                              e.currentTarget.style.color = "#4f46e5";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.1)";
                              e.currentTarget.style.color = "#334155";
                            }}
                          >
                            <span>📄</span>
                            <span>{downloadingDocId === `pdf-${msg.id}` ? "Exporting…" : "PDF"}</span>
                          </button>

                          {/* Export as Word */}
                          <button
                            type="button"
                            onClick={() => handleExportMessage(msg, "docx")}
                            title="Download this answer as a Word document (.docx)"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              background: "transparent",
                              border: "1px solid rgba(0, 0, 0, 0.1)",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              color: "#334155",
                              fontSize: "11.5px",
                              fontWeight: 500,
                              cursor: "pointer",
                              transition: "all 140ms ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#f1f5f9";
                              e.currentTarget.style.borderColor = "#2563eb";
                              e.currentTarget.style.color = "#2563eb";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.1)";
                              e.currentTarget.style.color = "#334155";
                            }}
                          >
                            <span>📝</span>
                            <span>{downloadingDocId === `docx-${msg.id}` ? "Exporting…" : "Word"}</span>
                          </button>

                          {/* Copy Answer */}
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.content, msg.id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#64748b",
                              fontSize: "12px",
                              cursor: "pointer",
                              padding: "3px 6px",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#0f172a")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                          >
                            {copiedId === msg.id ? "✓ Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* ── Active Streaming Turn ── */}
            {isStreaming && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", width: "100%" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #4f46e5, #6366f1, #3b82f6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(79, 70, 229, 0.25)",
                    flexShrink: 0,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="#fff" strokeWidth="2.5">
                    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                  </svg>
                </div>

                <div
                  style={{
                    flex: 1,
                    background: "rgba(255, 255, 255, 0.95)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid rgba(79, 70, 229, 0.2)",
                    borderRadius: "18px",
                    padding: "20px 24px",
                    boxShadow: "0 8px 30px rgba(79, 70, 229, 0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {/* Streaming steps */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {streamingSteps.map((st, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: "11px",
                          fontWeight: 500,
                          color: st.status === "completed" ? "#334155" : "#4f46e5",
                          background: st.status === "completed" ? "#f1f5f9" : "rgba(79, 70, 229, 0.08)",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {st.status === "completed" ? "✓" : "●"} {st.step}
                      </span>
                    ))}
                  </div>

                  {/* Streaming text with pulsing cursor */}
                  <div style={{ fontSize: "14.5px", lineHeight: 1.7, color: "#0f172a", whiteSpace: "pre-line" }}>
                    {streamingAnswer}
                    <span
                      style={{
                        display: "inline-block",
                        width: "6px",
                        height: "15px",
                        background: "#4f46e5",
                        marginLeft: "4px",
                        verticalAlign: "middle",
                        animation: "pulse 1s infinite",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Sticky Bottom Input Bar (Claude & ChatGPT Style Continuation) ── */}
      {hasMessages && (
        <div
          data-grid-avoid
          style={{
            position: "fixed",
            bottom: "82px",
            left: isSidebarOpen ? "272px" : "0",
            right: "0",
            zIndex: 35,
            display: "flex",
            justifyContent: "center",
            padding: "0 24px",
            pointerEvents: "none",
            transition: "left 260ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ width: "100%", maxWidth: "780px", pointerEvents: "auto" }}>
            <ChatInputBar
              query={inputQuery}
              setQuery={setInputQuery}
              onSend={handleSendQuery}
              isStreaming={isStreaming}
              models={models}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              modes={modes}
              selectedMode={selectedMode}
              setSelectedMode={setSelectedMode}
              collections={collections}
              collection={collection}
              setCollection={setCollection}
              isListening={isListening}
              toggleVoice={toggleVoice}
              textareaRef={textareaRef}
              isSticky={true}
            />
          </div>
        </div>
      )}

      {/* ── Citation Passage Preview Drawer ── */}
      {selectedCitation && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.35)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setSelectedCitation(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "580px",
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 28px 60px rgba(0, 0, 0, 0.2)",
              border: "1px solid rgba(0, 0, 0, 0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#4f46e5",
                    background: "rgba(79, 70, 229, 0.08)",
                    padding: "2px 8px",
                    borderRadius: "6px",
                  }}
                >
                  Citation [{selectedCitation.index}]
                </span>
                <h4 style={{ margin: "6px 0 0 0", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                  {selectedCitation.source}
                </h4>
                {selectedCitation.section && (
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    Section: {selectedCitation.section}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedCitation(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: "16px",
                borderRadius: "12px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: "13.5px",
                lineHeight: 1.6,
                color: "#1e293b",
                fontFamily: "monospace",
                maxHeight: "260px",
                overflowY: "auto",
              }}
            >
              {selectedCitation.snippet || "Passage chunk retrieved from Qdrant vector index."}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "18px" }}>
              <button
                type="button"
                onClick={() => setSelectedCitation(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  background: "#4f46e5",
                  color: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Chat Input Bar Component (Reusable for Centered & Sticky Bottom)
   ───────────────────────────────────────────────────────────────────────────── */

function ChatInputBar({
  query,
  setQuery,
  onSend,
  isStreaming,
  models,
  selectedModel,
  setSelectedModel,
  modes,
  selectedMode,
  setSelectedMode,
  collections,
  collection,
  setCollection,
  isListening,
  toggleVoice,
  textareaRef,
  isSticky = false,
}: {
  query: string;
  setQuery: (v: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  models: { id: string; name: string; tier: string; provider: string }[];
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  modes: { id: string; label: string; desc: string }[];
  selectedMode: "Fast" | "Medium" | "Deep";
  setSelectedMode: (m: "Fast" | "Medium" | "Deep") => void;
  collections: string[];
  collection: string;
  setCollection: (c: string) => void;
  isListening: boolean;
  toggleVoice: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  isSticky?: boolean;
}) {
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isColOpen, setIsColOpen] = useState(false);

  return (
    <div
      style={{
        width: "100%",
        background: isSticky ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.88)",
        backdropFilter: "blur(24px) saturate(1.8)",
        WebkitBackdropFilter: "blur(24px) saturate(1.8)",
        borderRadius: "20px",
        border: "1px solid rgba(0, 0, 0, 0.12)",
        boxShadow: isSticky
          ? "0 16px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)"
          : "0 10px 30px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.03)",
        padding: "14px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        transition: "box-shadow 200ms ease, border-color 200ms ease",
      }}
    >
      <textarea
        ref={textareaRef}
        rows={isSticky ? 2 : 3}
        placeholder="Ask a question across enterprise documents, or ask to download as PDF/Word…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          outline: "none",
          resize: "none",
          fontSize: "15px",
          lineHeight: 1.5,
          color: "#0f172a",
          fontFamily: "inherit",
        }}
      />

      {/* Control Bar: Model, Collection, Voice, Send */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Model Selector */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => {
                setIsModelOpen(!isModelOpen);
                setIsColOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 10px",
                borderRadius: "8px",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                fontSize: "12px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <span>{selectedModel}</span>
              <span style={{ fontSize: "9px" }}>▾</span>
            </button>

            {isModelOpen && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  left: 0,
                  width: "240px",
                  background: "#ffffff",
                  borderRadius: "12px",
                  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.15)",
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  padding: "6px",
                  zIndex: 80,
                }}
              >
                {models.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.name);
                      setIsModelOpen(false);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      background: selectedModel === m.name ? "rgba(79, 70, 229, 0.08)" : "transparent",
                      color: selectedModel === m.name ? "#4f46e5" : "#0f172a",
                      fontSize: "12px",
                      fontWeight: selectedModel === m.name ? 600 : 400,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        selectedModel === m.name ? "rgba(79, 70, 229, 0.08)" : "transparent")
                    }
                  >
                    <div>{m.name}</div>
                    <div style={{ fontSize: "10px", color: "#64748b" }}>{m.tier}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collection Selector */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => {
                setIsColOpen(!isColOpen);
                setIsModelOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 10px",
                borderRadius: "8px",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                fontSize: "12px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <span>📁 {collection}</span>
              <span style={{ fontSize: "9px" }}>▾</span>
            </button>

            {isColOpen && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  left: 0,
                  width: "180px",
                  background: "#ffffff",
                  borderRadius: "12px",
                  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.15)",
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  padding: "6px",
                  zIndex: 80,
                }}
              >
                {collections.map((col) => (
                  <div
                    key={col}
                    onClick={() => {
                      setCollection(col);
                      setIsColOpen(false);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      background: collection === col ? "rgba(79, 70, 229, 0.08)" : "transparent",
                      color: collection === col ? "#4f46e5" : "#0f172a",
                      fontSize: "12px",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        collection === col ? "rgba(79, 70, 229, 0.08)" : "transparent")
                    }
                  >
                    {col}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice Dictation */}
          <button
            type="button"
            onClick={toggleVoice}
            title={isListening ? "Listening..." : "Dictate query with voice"}
            style={{
              padding: "5px 9px",
              borderRadius: "8px",
              background: isListening ? "#fee2e2" : "#f1f5f9",
              border: isListening ? "1px solid #f87171" : "1px solid #cbd5e1",
              color: isListening ? "#dc2626" : "#475569",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              fontSize: "12px",
            }}
          >
            🎤
          </button>
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={() => onSend()}
          disabled={!query.trim() || isStreaming}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "10px",
            background: !query.trim() || isStreaming ? "#cbd5e1" : "#4f46e5",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 600,
            border: "none",
            cursor: !query.trim() || isStreaming ? "not-allowed" : "pointer",
            transition: "all 150ms ease",
          }}
        >
          <span>{isStreaming ? "Synthesizing…" : "Ask"}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ChatConversation;
