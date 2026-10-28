"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { askStream, getDocuments, TitanApiError } from "@/lib/api";

import { PromptInput } from "@/components/ui/ai-chat-input";

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
  const [selectedModel, setSelectedModel] = useState("Ollama (Local 1.5B)");
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
    { id: "qwen2.5:1.5b", name: "Ollama (Local 1.5B)", tier: "Lightweight (~1.5B params)", provider: "ollama" },
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
      {/* ── COLLECTION SELECTOR & AI CHAT INPUT (SENT BY USER) ── */}
      <div className="w-full flex flex-col items-center">
        {/* Active Collection Selector */}
        <div className="flex items-center gap-2 mb-3 z-20">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCollectionPickerOpen(!isCollectionPickerOpen)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 shadow-sm transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>Corpus: <strong>{collection}</strong></span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isCollectionPickerOpen && (
              <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-48 bg-white border border-slate-200 rounded-xl p-1.5 shadow-xl z-50">
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Target Corpus
                </div>
                {collections.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => {
                      setCollection(col);
                      setIsCollectionPickerOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                      collection === col ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{col}</span>
                    {collection === col && <span>✓</span>}
                  </button>
                ))}
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <Link
                    href="/app/documents"
                    className="block px-2 py-1 text-[11px] text-indigo-600 font-medium hover:underline"
                  >
                    + Manage in Documents →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PromptInput Component sent by the user */}
        <div className="w-full flex justify-center">
          <PromptInput
            placeholder="Ask questions across your ingested corpus..."
            models={models.map((m) => m.name)}
            efforts={["Fast", "Medium", "Deep"]}
            defaultValue={question}
            value={question}
            onChange={(val) => setQuestion(val)}
            onSubmit={(val, meta) => {
              if (meta?.model) setSelectedModel(meta.model);
              if (meta?.effort) setSelectedMode(meta.effort as any);
              handleAsk(val);
            }}
          />
        </div>
      </div>

      {/* Notice if no documents uploaded */}
      {hasDocuments === false && !hasStarted && (
        <div
          style={{
            marginTop: "16px",
            padding: "10px 16px",
            borderRadius: "12px",
            background: "#f8fafc",
            border: "1px dashed #cbd5e1",
            fontSize: "12px",
            color: "#64748b",
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
              color: "#4f46e5",
              fontWeight: 600,
              textDecoration: "underline",
              marginLeft: "8px",
            }}
          >
            Upload your first document →
          </Link>
        </div>
      )}

      {/* ── ANSWER & PIPELINE CARD (Clean White Apple-Grade Card) ── */}
      {hasStarted && (
        <div
          style={{
            width: "100%",
            marginTop: "20px",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 20px 45px -10px rgba(0, 0, 0, 0.08)",
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
              <span style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: isStreaming ? "#4f46e5" : "#94a3b8",
                boxShadow: isStreaming ? "0 0 10px rgba(79,70,229,0.5)" : "none",
                display: "inline-block",
                animation: isStreaming ? "pulse 1.5s ease infinite" : "none",
                transition: "all 300ms ease",
              }} />
              <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4f46e5" }}>
                Titan Grounded Reasoning
              </span>
              {confidence?.composite !== undefined && (
                <span style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  backgroundColor: "#dcfce7",
                  color: "#166534",
                  border: "1px solid #bbf7d0",
                }}>
                  {Math.round(confidence.composite * 100)}% Confidence
                </span>
              )}
              {hallucination && (
                <span style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  backgroundColor: hallucination.score <= 0.25 ? "#dbeafe" : "#fef9c3",
                  color: hallucination.score <= 0.25 ? "#1e40af" : "#854d0e",
                  border: hallucination.score <= 0.25 ? "1px solid #bfdbfe" : "1px solid #fef08a",
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
                color: "#94a3b8",
                cursor: "pointer",
                padding: "4px",
                fontSize: "14px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#0f172a")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
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
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}>
              {steps.map((st, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.6875rem", fontWeight: 500, color: st.status === "completed" ? "#334155" : "#4f46e5" }}>
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
              backgroundColor: "#fee2e2",
              border: "1px solid #fecaca",
              color: "#991b1b",
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
              <div style={{ fontSize: "13px", color: "#7f1d1d" }}>
                {error.message}
              </div>
              {error.message.includes("API keys configured") && (
                <div style={{ fontSize: "12px", color: "#991b1b", marginTop: "4px" }}>
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
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
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
              <div style={{ fontSize: "13px", color: "#78350f" }}>
                {abstention.missing}
              </div>
              {abstention.found.length > 0 && (
                <div style={{ fontSize: "12px", color: "#b45309" }}>
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
                    backgroundColor: "#4f46e5",
                    color: "#ffffff",
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
              color: "#0f172a",
              whiteSpace: "pre-line",
            }}>
              {streamedAnswer}
              {isStreaming && (
                <span style={{
                  display: "inline-block",
                  width: "6px",
                  height: "15px",
                  backgroundColor: "#4f46e5",
                  marginLeft: "4px",
                  verticalAlign: "middle",
                  animation: "pulse 1s infinite",
                }} />
              )}
            </div>
          )}

          {/* Citations badges */}
          {citations.length > 0 && (
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
                      backgroundColor: selectedCitation?.index === c.index ? "#e0e7ff" : "#f1f5f9",
                      border: selectedCitation?.index === c.index ? "1px solid #4f46e5" : "1px solid #e2e8f0",
                      color: selectedCitation?.index === c.index ? "#3730a3" : "#0f172a",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontWeight: 700, color: "#4f46e5" }}>[{c.index}]</span>
                    <span style={{ fontWeight: 500 }}>{c.source}</span>
                    {c.page && <span style={{ opacity: 0.6 }}>p.{c.page}</span>}
                    {c.verdict && (
                      <span
                        style={{
                          display: "inline-block",
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: c.verdict === "supported" ? "#16a34a" : "#d97706",
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
                  backgroundColor: "#f8fafc",
                  border: "1px solid #c7d2fe",
                  fontSize: "0.8125rem",
                  color: "#0f172a",
                }}>
                  <div style={{ fontWeight: 600, color: "#4f46e5", marginBottom: "6px", display: "flex", justifyContent: "space-between" }}>
                    <span>
                      Evidence [{selectedCitation.index}]: {selectedCitation.source} {selectedCitation.section && `• ${selectedCitation.section}`}
                    </span>
                    {selectedCitation.page && <span>Page {selectedCitation.page}</span>}
                  </div>
                  <div style={{ fontStyle: "italic", color: "#334155", lineHeight: 1.5 }}>
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
