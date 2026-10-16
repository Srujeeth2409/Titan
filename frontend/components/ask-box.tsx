"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { askStream, getDocuments, TitanApiError } from "@/lib/api";

export interface Citation {
  index: number;
  chunk_id: string;
  source: string;
  section: string;
  page?: number;
  snippet?: string;
  verdict?: "supported" | "partial" | "unsupported" | string;
  confidence?: number;
  sentence?: string;
}

export interface Confidence {
  composite?: number;
  retrieval?: number;
  citation_coverage?: number;
  completeness?: number;
  hallucination_risk?: number;
}

interface StepEvent {
  step: string;
  status: "started" | "completed";
}

interface AbstentionData {
  found: string[];
  missing: string;
  suggested_documents: string[];
}

export interface HallucinationInfo {
  score: number;
  unsupported_claims?: string[];
  contradictions?: string[];
  total_claims?: number;
}

export function AskBox({ id }: { id?: string }) {
  const [question, setQuestion] = useState("");
  const [selectedModel, setSelectedModel] = useState("Ollama (Local)");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"Fast" | "Medium" | "Deep">("Medium");
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  // Attachment / Collection
  const [collection, setCollection] = useState("default");
  const [collections, setCollections] = useState<string[]>(["default"]);
  const [isCollectionPickerOpen, setIsCollectionPickerOpen] = useState(false);
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);

  // Voice listening state
  const [isListening, setIsListening] = useState(false);

  // Dynamic streaming & answer states
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [hallucination, setHallucination] = useState<HallucinationInfo | null>(null);
  const [abstention, setAbstention] = useState<AbstentionData | null>(null);
  const [error, setError] = useState<{ message: string; code?: string; traceId?: string } | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Real Models list matching backend LLMGateway
  const models = [
    { id: "qwen2.5:7b", name: "Ollama (Local)", tier: "Local Qwen 2.5", provider: "ollama" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", tier: "Strong", provider: "anthropic" },
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Groq)", tier: "Fast & Free", provider: "groq" },
    { id: "qwen-2.5-32b", name: "Qwen 2.5 32B (Groq)", tier: "Fast", provider: "groq" },
    { id: "gpt-4o", name: "GPT-4o (OpenAI)", tier: "Strong", provider: "openai" },
    { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (OpenRouter)", tier: "Free Tier", provider: "openrouter" },
  ];

  // Modes list
  const modes = [
    { id: "Fast", label: "⚡ Fast (Single)", desc: "Quick answer without multi-step decomposition" },
    { id: "Medium", label: "📊 Medium (Hybrid)", desc: "Dense Qdrant + Sparse retrieval with rerank" },
    { id: "Deep", label: "🧠 Deep (Agentic)", desc: "Multi-step reasoning and full source verification" },
  ];

  // Fetch available collections from real documents in database
  useEffect(() => {
    async function loadCollections() {
      try {
        const res = await getDocuments();
        if (res?.documents && Array.isArray(res.documents)) {
          setHasDocuments(res.documents.length > 0);
          const uniqueCols = Array.from(new Set(res.documents.map((d: any) => d.collection || "default"))) as string[];
          if (uniqueCols.length > 0) {
            setCollections(uniqueCols);
            setCollection(uniqueCols[0]);
          }
        } else {
          setHasDocuments(false);
        }
      } catch {
        setHasDocuments(false);
      }
    }
    loadCollections();
  }, []);

  // Handle ESC key to reset or close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsModelDropdownOpen(false);
        setIsModeDropdownOpen(false);
        setIsCollectionPickerOpen(false);
        setSelectedCitation(null);
        if (hasStarted && !isStreaming) {
          setHasStarted(false);
          setStreamedAnswer("");
          setSteps([]);
          setAbstention(null);
          setError(null);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasStarted, isStreaming]);

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
          setQuestion(transcript);
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

  const handleAsk = async (customQuery?: string) => {
    const query = (customQuery || question).trim();
    if (!query || isStreaming) return;

    setHasStarted(true);
    setIsStreaming(true);
    setStreamedAnswer("");
    setSteps([
      { step: "Query analysis & embedding generation", status: "started" },
    ]);
    setCitations([]);
    setConfidence(null);
    setHallucination(null);
    setAbstention(null);
    setError(null);
    setSelectedCitation(null);

    const apiMode = selectedMode === "Fast" ? "single" : selectedMode === "Deep" ? "agentic" : "auto";
    const selectedModelObj = models.find((m) => m.name === selectedModel);

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
        throw new TitanApiError(response.status, {
          code: errCode,
          message: errMessage,
          trace_id: "",
        });
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
              setSteps((prev) => {
                const existing = prev.find((s) => s.step === data.step);
                if (existing) return prev;
                return [...prev, { step: data.step || "Processing", status: "started" }];
              });
            } else if (eventType === "step_completed") {
              setSteps((prev) =>
                prev.map((s) => (s.step === (data.step || s.step) ? { ...s, status: "completed" } : s))
              );
            } else if (eventType === "token") {
              setStreamedAnswer((prev) => prev + (data.token || data.text || ""));
            } else if (eventType === "answer_final") {
              if (data.status === "abstained") {
                setAbstention(data.abstention || {
                  found: [],
                  missing: "No relevant documents found in this collection.",
                  suggested_documents: ["Upload reference files via the Documents page."],
                });
                if (data.confidence) setConfidence(data.confidence);
              } else {
                if (data.answer) setStreamedAnswer(data.answer);
                if (data.citations) setCitations(data.citations);
                if (data.confidence) setConfidence(data.confidence);
                if (data.hallucination) setHallucination(data.hallucination);
              }
            } else if (eventType === "error") {
              setError({
                message: data.message || "An error occurred during query execution.",
                code: data.code,
                traceId: data.trace_id,
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err instanceof TitanApiError) {
        setError({ message: err.message, code: err.code, traceId: err.traceId });
      } else {
        setError({ message: err.message || "Failed to execute query against Titan backend." });
      }
    } finally {
      setIsStreaming(false);
      setSteps((prev) => prev.map((s) => ({ ...s, status: "completed" })));
    }
  };

  return (
    <div
      id={id}
      ref={containerRef}
      style={{
        position: "relative",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: hasStarted ? "740px" : "620px",
        margin: "0 auto",
        transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* ── CHAT BAR CARD ── */}
      <div
        style={{
          width: "100%",
          backgroundColor: "rgba(22, 22, 26, 0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "20px",
          padding: "12px 16px",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.08)",
          boxSizing: "border-box",
        }}
      >
        {/* Top Input Row */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Collection Button */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsCollectionPickerOpen(!isCollectionPickerOpen)}
              title={`Collection: ${collection}`}
              style={{
                height: "32px",
                padding: "0 10px",
                borderRadius: "16px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 500,
                flexShrink: 0,
                transition: "background-color 150ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.16)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>{collection}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Collection Dropdown */}
            {isCollectionPickerOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  width: "220px",
                  backgroundColor: "#16161a",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "12px",
                  padding: "6px",
                  boxShadow: "0 12px 36px rgba(0, 0, 0, 0.6)",
                  zIndex: 100,
                }}
              >
                <div style={{ padding: "6px 8px", fontSize: "11px", fontWeight: 600, color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase" }}>
                  Active Collection
                </div>
                {collections.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => {
                      setCollection(col);
                      setIsCollectionPickerOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      backgroundColor: collection === col ? "rgba(255, 255, 255, 0.12)" : "transparent",
                      border: "none",
                      color: "#ffffff",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{col}</span>
                    {collection === col && <span style={{ color: "#22c55e" }}>✓</span>}
                  </button>
                ))}
                <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", marginTop: "4px", paddingTop: "4px" }}>
                  <Link
                    href="/app/documents"
                    style={{
                      display: "block",
                      padding: "6px 8px",
                      fontSize: "12px",
                      color: "#60a5fa",
                      textDecoration: "none",
                    }}
                  >
                    + Manage in Documents →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Input field */}
          <div
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              alignItems: "center",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "10px",
              padding: "7px 12px",
              backgroundColor: "rgba(0, 0, 0, 0.35)",
              transition: "border-color 0.2s ease",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              placeholder="Ask questions across your ingested corpus..."
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#ffffff",
                fontSize: "0.875rem",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Voice Input */}
          <button
            type="button"
            onClick={toggleVoice}
            title={isListening ? "Listening..." : "Voice input"}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: isListening ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.08)",
              border: isListening ? "1px solid #ef4444" : "none",
              color: isListening ? "#ef4444" : "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              transition: "all 150ms",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          {/* Submit Action Button */}
          <button
            type="button"
            onClick={() => handleAsk()}
            disabled={isStreaming || !question.trim()}
            style={{
              height: "32px",
              padding: "0 14px",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              color: "#000000",
              fontWeight: 600,
              fontSize: "12px",
              border: "none",
              cursor: isStreaming || !question.trim() ? "not-allowed" : "pointer",
              opacity: isStreaming || !question.trim() ? 0.4 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            {isStreaming ? "Thinking..." : "Ask"}
          </button>
        </div>

        {/* Bottom Options Row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", paddingTop: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Model Pill */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  setIsModelDropdownOpen(!isModelDropdownOpen);
                  setIsModeDropdownOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 150ms",
                }}
              >
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#22c55e" }} />
                <span>{selectedModel}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Model Dropdown Menu */}
              {isModelDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    width: "240px",
                    backgroundColor: "#16161a",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "12px",
                    padding: "6px",
                    boxShadow: "0 12px 36px rgba(0, 0, 0, 0.6)",
                    zIndex: 100,
                  }}
                >
                  <div style={{ padding: "6px 8px", fontSize: "11px", fontWeight: 600, color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase" }}>
                    Select Real LLM Provider
                  </div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m.name);
                        setIsModelDropdownOpen(false);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        backgroundColor: selectedModel === m.name ? "rgba(255, 255, 255, 0.12)" : "transparent",
                        border: "none",
                        color: "#ffffff",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500 }}>{m.name}</div>
                        <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.4)" }}>{m.provider} • {m.tier}</div>
                      </div>
                      {selectedModel === m.name && <span style={{ color: "#22c55e" }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mode Pill */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  setIsModeDropdownOpen(!isModeDropdownOpen);
                  setIsModelDropdownOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <span>{selectedMode} Mode</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isModeDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    width: "260px",
                    backgroundColor: "#16161a",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "12px",
                    padding: "6px",
                    boxShadow: "0 12px 36px rgba(0, 0, 0, 0.6)",
                    zIndex: 100,
                  }}
                >
                  <div style={{ padding: "6px 8px", fontSize: "11px", fontWeight: 600, color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase" }}>
                    Reasoning Pipeline Mode
                  </div>
                  {modes.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedMode(m.id as any);
                        setIsModeDropdownOpen(false);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        backgroundColor: selectedMode === m.id ? "rgba(255, 255, 255, 0.12)" : "transparent",
                        border: "none",
                        color: "#ffffff",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{m.label}</div>
                      <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.4)" }}>{m.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.4)" }}>
            Press <kbd style={{ padding: "2px 5px", background: "rgba(255,255,255,0.08)", borderRadius: "4px" }}>Enter ↵</kbd>
          </div>
        </div>
      </div>

      {/* Notice if no documents uploaded */}
      {hasDocuments === false && !hasStarted && (
        <div
          style={{
            marginTop: "16px",
            padding: "10px 16px",
            borderRadius: "12px",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px dashed rgba(255, 255, 255, 0.15)",
            fontSize: "12px",
            color: "rgba(255, 255, 255, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <span>No documents indexed in your workspace yet.</span>
          <Link
            href="/app/documents"
            style={{
              color: "#ffffff",
              fontWeight: 600,
              textDecoration: "underline",
              marginLeft: "8px",
            }}
          >
            Upload your first document →
          </Link>
        </div>
      )}

      {/* ── ANSWER & PIPELINE CARD ── */}
      {hasStarted && (
        <div
          style={{
            width: "100%",
            marginTop: "20px",
            backgroundColor: "rgba(22, 22, 26, 0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7)",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            animation: "fadeIn 300ms ease",
          }}
        >
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#60a5fa" }}>
                Titan Grounded Reasoning
              </span>
              {confidence?.composite !== undefined && (
                <span style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  backgroundColor: "rgba(34, 197, 94, 0.12)",
                  color: "#4ade80",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                }}>
                  {Math.round(confidence.composite * 100)}% Confidence
                </span>
              )}
              {hallucination && (
                <span style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  backgroundColor: hallucination.score <= 0.25 ? "rgba(59, 130, 246, 0.12)" : "rgba(234, 179, 8, 0.12)",
                  color: hallucination.score <= 0.25 ? "#60a5fa" : "#facc15",
                  border: hallucination.score <= 0.25 ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid rgba(234, 179, 8, 0.25)",
                }}>
                  {hallucination.score <= 0.25 ? "✓ Grounded" : `${Math.round(hallucination.score * 100)}% Hallucination Risk`}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setHasStarted(false);
                setStreamedAnswer("");
                setSteps([]);
                setAbstention(null);
                setHallucination(null);
                setError(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255, 255, 255, 0.4)",
                cursor: "pointer",
                padding: "4px",
                fontSize: "14px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)")}
            >
              ✕
            </button>
          </div>

          {/* Pipeline execution steps */}
          {steps.length > 0 && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              padding: "10px 14px",
              borderRadius: "12px",
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}>
              {steps.map((st, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.6875rem", color: st.status === "completed" ? "rgba(255, 255, 255, 0.8)" : "#60a5fa" }}>
                  <span>{st.status === "completed" ? "✓" : "●"}</span>
                  <span>{st.step}</span>
                </div>
              ))}
            </div>
          )}

          {/* Real Error Banner */}
          {error && (
            <div style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Query Failed {error.code ? `(${error.code})` : ""}</span>
              </div>
              <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.8)" }}>
                {error.message}
              </div>
              {error.message.includes("API keys configured") && (
                <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)", marginTop: "4px" }}>
                  💡 Tip: Add your <code>ANTHROPIC_API_KEY</code>, <code>GROQ_API_KEY</code>, or <code>OPENAI_API_KEY</code> to the <code>.env</code> file in your workspace, or choose <em>Ollama (Local)</em> from the model menu.
                </div>
              )}
            </div>
          )}

          {/* Real Abstention Card */}
          {abstention && (
            <div style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              color: "#fde68a",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>No Grounded Passages Found</span>
              </div>
              <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.85)" }}>
                {abstention.missing}
              </div>
              {abstention.found.length > 0 && (
                <div style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.55)" }}>
                  Documents searched: {abstention.found.join(", ")}
                </div>
              )}
              <div style={{ marginTop: "6px" }}>
                <Link
                  href="/app/documents"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    backgroundColor: "#ffffff",
                    color: "#000000",
                    fontWeight: 600,
                    fontSize: "12px",
                    textDecoration: "none",
                  }}
                >
                  Upload Documents to Collection &quot;{collection}&quot; →
                </Link>
              </div>
            </div>
          )}

          {/* Real Answer text stream */}
          {streamedAnswer && (
            <div style={{
              fontSize: "0.9375rem",
              lineHeight: 1.7,
              color: "#ffffff",
              whiteSpace: "pre-line",
            }}>
              {streamedAnswer}
              {isStreaming && (
                <span style={{
                  display: "inline-block",
                  width: "6px",
                  height: "15px",
                  backgroundColor: "#60a5fa",
                  marginLeft: "4px",
                  verticalAlign: "middle",
                  animation: "pulse 1s infinite",
                }} />
              )}
            </div>
          )}

          {/* Citations badges */}
          {citations.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "0.6875rem", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Verified Citations ({citations.length})
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {citations.map((c) => (
                  <button
                    key={c.index}
                    type="button"
                    onClick={() => setSelectedCitation(selectedCitation?.index === c.index ? null : c)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 12px",
                      borderRadius: "8px",
                      backgroundColor: selectedCitation?.index === c.index ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.06)",
                      border: selectedCitation?.index === c.index ? "1px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#ffffff",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "#60a5fa" }}>[{c.index}]</span>
                    <span>{c.source}</span>
                    {c.page && <span style={{ opacity: 0.5 }}>p.{c.page}</span>}
                    {c.verdict && (
                      <span
                        style={{
                          display: "inline-block",
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: c.verdict === "supported" ? "#22c55e" : "#eab308",
                          marginLeft: "2px",
                        }}
                        title={`Status: ${c.verdict}`}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Source snippet popup */}
              {selectedCitation && (
                <div style={{
                  marginTop: "8px",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(0, 0, 0, 0.45)",
                  border: "1px solid rgba(59, 130, 246, 0.35)",
                  fontSize: "0.8125rem",
                  color: "rgba(255, 255, 255, 0.88)",
                }}>
                  <div style={{ fontWeight: 600, color: "#60a5fa", marginBottom: "6px", display: "flex", justifyContent: "space-between" }}>
                    <span>
                      Evidence [{selectedCitation.index}]: {selectedCitation.source} {selectedCitation.section && `• ${selectedCitation.section}`}
                    </span>
                    {selectedCitation.page && <span>Page {selectedCitation.page}</span>}
                  </div>
                  <div style={{ fontStyle: "italic", color: "rgba(255, 255, 255, 0.8)", lineHeight: 1.5 }}>
                    &ldquo;{selectedCitation.snippet || "Direct evidence excerpt anchored by cryptographic chunk hash."}&rdquo;
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
