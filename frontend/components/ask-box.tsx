"use client";

import { useState, useRef, useEffect } from "react";
import { askStream, getDocuments, TitanApiError } from "@/lib/api";

export interface Citation {
  index: number;
  chunk_id: string;
  source: string;
  section: string;
  page?: number;
  snippet?: string;
}

export interface Confidence {
  composite?: number;
  retrieval?: number;
  citation_coverage?: number;
  completeness?: number;
}

interface StepEvent {
  step: string;
  status: "started" | "completed";
}

export function AskBox({ id }: { id?: string }) {
  const [question, setQuestion] = useState("");
  const [selectedModel, setSelectedModel] = useState("GPT 5.5");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"Fast" | "Medium" | "Deep">("Medium");
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  // Attachment / Collection
  const [collection, setCollection] = useState("default");
  const [collections, setCollections] = useState<string[]>(["default"]);
  const [isCollectionPickerOpen, setIsCollectionPickerOpen] = useState(false);

  // Voice listening state
  const [isListening, setIsListening] = useState(false);

  // Dynamic streaming & answer states
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Models list
  const models = [
    { id: "gpt-5.5", name: "GPT 5.5", tier: "Strong", provider: "OpenAI" },
    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", tier: "Strong", provider: "Anthropic" },
    { id: "llama-3-3-70b", name: "Llama 3.3 70B", tier: "Fast & Free", provider: "Groq" },
    { id: "qwen-3-32b", name: "Qwen3 32B", tier: "Free", provider: "OpenRouter" },
    { id: "ollama-local", name: "Ollama (Local)", tier: "Local", provider: "Ollama" },
  ];

  // Modes list
  const modes = [
    { id: "Fast", label: "⚡ Fast (Single)", desc: "Quick answer without multi-step decomposition" },
    { id: "Medium", label: "📊 Medium (Hybrid)", desc: "Standard dense + sparse retrieval with rerank" },
    { id: "Deep", label: "🧠 Deep (Agentic)", desc: "Multi-step reasoning and full source verification" },
  ];

  // Fetch available collections from backend if available
  useEffect(() => {
    async function loadCollections() {
      try {
        const res = await getDocuments();
        if (res?.documents && Array.isArray(res.documents)) {
          const uniqueCols = Array.from(
            new Set(res.documents.map((d: any) => d.collection || "default"))
          ) as string[];
          if (uniqueCols.length > 0) {
            setCollections(uniqueCols);
            setCollection(uniqueCols[0]);
          }
        }
      } catch {
        // Fall back gracefully
      }
    }
    loadCollections();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        setIsModelDropdownOpen(false);
        setIsModeDropdownOpen(false);
        setIsCollectionPickerOpen(false);
        setSelectedCitation(null);
        if (hasStarted) {
          setHasStarted(false);
          setStreamedAnswer("");
          setSteps([]);
          setError(null);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasStarted]);

  // Stop voice recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
    };
  }, []);

  // Voice input (Web Speech API)
  function toggleVoice() {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setHasStarted(true);
      setError("Voice input is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      setQuestion(e.results[0][0].transcript);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }

  async function handleAsk(override?: string) {
    const q = (override ?? question).trim();
    if (!q || isStreaming) return;

    setHasStarted(true);
    setIsStreaming(true);
    setError(null);
    setStreamedAnswer("");
    setSteps([]);
    setCitations([]);
    setConfidence(null);
    setSelectedCitation(null);

    // Handle one parsed SSE event. Tolerant of a few common payload shapes.
    function applyEvent(name: string, payload: any) {
      const data = payload && typeof payload === "object" ? payload : {};
      switch (name) {
        case "step":
        case "status":
        case "pipeline": {
          const stepName = data.step ?? data.name;
          if (!stepName) break;
          const status: StepEvent["status"] =
            data.status === "completed" || data.status === "done" ? "completed" : "started";
          setSteps((prev) => {
            const i = prev.findIndex((s) => s.step === stepName);
            if (i >= 0) {
              const next = [...prev];
              next[i] = { step: stepName, status };
              return next;
            }
            return [...prev, { step: stepName, status }];
          });
          break;
        }
        case "token":
        case "delta":
        case "chunk":
        case "answer": {
          const text =
            typeof payload === "string"
              ? payload
              : data.text ?? data.token ?? data.delta ?? data.content ?? "";
          if (text) setStreamedAnswer((prev) => prev + text);
          break;
        }
        case "citations":
          setCitations(Array.isArray(payload) ? payload : data.citations ?? []);
          break;
        case "confidence":
          setConfidence(data.confidence ?? data);
          break;
        case "done":
        case "final":
        case "complete":
          if (typeof data.answer === "string") setStreamedAnswer(data.answer);
          if (Array.isArray(data.citations)) setCitations(data.citations);
          if (data.confidence) setConfidence(data.confidence);
          break;
        case "error":
          throw new Error(data.message || data.detail || "The server reported an error.");
      }
    }

    try {
      const res = await askStream(q, collection, selectedMode.toLowerCase());
      if (!res.ok || !res.body) {
        throw new TitanApiError(res.status, {
          code: `HTTP-${res.status}`,
          message: res.statusText || "Request failed",
          trace_id: "",
        });
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          let eventName = "";
          const dataLines: string[] = [];
          for (const line of block.split(/\r?\n/)) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          if (dataLines.length === 0) continue;
          const raw = dataLines.join("\n");
          if (raw === "[DONE]") continue;

          let payload: any = raw;
          try {
            payload = JSON.parse(raw);
          } catch {
            // plain-text data (e.g. a raw token)
          }
          const name = eventName || payload?.type || payload?.event || "token";
          applyEvent(name, payload);
        }
      }
    } catch (err) {
      setError(
        err instanceof TitanApiError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsStreaming(false);
    }
  }

  const suggestions = [
    "What does Titan cite in an answer?",
    "Summarize the retrieval architecture",
    "Which documents are in the default collection?",
  ];

  return (
    <div id={id} ref={containerRef} className={`composer ${hasStarted ? "expanded" : ""}`}>
      <div className="composer-card">
        <div className="composer-row">
          <button
            type="button"
            className="composer-icon-btn"
            onClick={() => setIsCollectionPickerOpen(!isCollectionPickerOpen)}
            title="Select collection"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <div className="composer-field">
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
              placeholder="Ask across your documents…"
            />
          </div>

          <button
            type="button"
            className={`composer-icon-btn ${isListening ? "listening" : ""}`}
            onClick={toggleVoice}
            title={isListening ? "Listening..." : "Voice input"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          <button
            type="button"
            className="composer-send"
            disabled={!question.trim() || isStreaming}
            onClick={() => handleAsk()}
            title="Ask"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>

        <div className="composer-toolbar">
          <div className="composer-pills">
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="composer-pill"
                onClick={() => {
                  setIsModelDropdownOpen(!isModelDropdownOpen);
                  setIsModeDropdownOpen(false);
                }}
              >
                <span className="dot" />
                <span>{selectedModel}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {isModelDropdownOpen && (
                <div className="menu">
                  <div className="menu-label">Engine</div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`menu-item ${selectedModel === m.name ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedModel(m.name);
                        setIsModelDropdownOpen(false);
                      }}
                    >
                      <span>{m.name}</span>
                      <span className="tier">{m.tier}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="composer-pill"
                onClick={() => {
                  setIsModeDropdownOpen(!isModeDropdownOpen);
                  setIsModelDropdownOpen(false);
                }}
              >
                <span>{selectedMode}</span>
              </button>
              {isModeDropdownOpen && (
                <div className="menu">
                  <div className="menu-label">Retrieval mode</div>
                  {modes.map((md) => (
                    <button
                      key={md.id}
                      type="button"
                      className={`menu-item ${selectedMode === md.id ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedMode(md.id as "Fast" | "Medium" | "Deep");
                        setIsModeDropdownOpen(false);
                      }}
                    >
                      <span>
                        {md.label}
                        <small>{md.desc}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isCollectionPickerOpen && (
              <div className="menu" style={{ left: 16, top: "calc(100% + 8px)" }}>
                <div className="menu-label">Collection</div>
                {collections.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`menu-item ${collection === c ? "selected" : ""}`}
                    onClick={() => {
                      setCollection(c);
                      setIsCollectionPickerOpen(false);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="composer-hint">{collection} · Enter to ask</span>
        </div>
      </div>

      {!hasStarted && (
        <div className="suggestion-row">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="suggestion-chip"
              onClick={() => {
                setQuestion(s);
                handleAsk(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {hasStarted && (
        <div className="answer-panel">
          <div className="answer-head">
            <div className="answer-status">
              <span className={isStreaming ? "live" : "ready"} />
              <span>{isStreaming ? "Retrieving and verifying…" : "Grounded answer"}</span>
            </div>
            {confidence && (
              <div className="confidence-chip">
                {Math.round((confidence.composite || 0.95) * 100)}% confidence
              </div>
            )}
            <button
              type="button"
              className="answer-close"
              onClick={() => {
                setHasStarted(false);
                setStreamedAnswer("");
                setSteps([]);
                setError(null);
              }}
            >
              ✕
            </button>
          </div>

          {steps.length > 0 && (
            <div className="pipeline">
              {steps.map((st, i) => (
                <div key={i} className={`pipeline-step ${st.status === "completed" ? "done" : ""}`}>
                  <span>{st.status === "completed" ? "✓" : "●"}</span>
                  <span>{st.step}</span>
                </div>
              ))}
            </div>
          )}

          <div className="answer-body">
            {error || streamedAnswer || (isStreaming ? "Analyzing sources…" : "")}
          </div>

          {citations.length > 0 && (
            <div>
              <div className="sources-label">Verified sources</div>
              <div className="sources-row">
                {citations.map((c) => (
                  <button
                    key={c.index}
                    type="button"
                    className={`source-chip ${selectedCitation?.index === c.index ? "active" : ""}`}
                    onClick={() => setSelectedCitation(selectedCitation?.index === c.index ? null : c)}
                  >
                    <span className="idx">[{c.index}]</span>
                    <span>{c.source}</span>
                  </button>
                ))}
              </div>
              {selectedCitation && (
                <div className="source-excerpt">
                  <strong>
                    Source [{selectedCitation.index}]: {selectedCitation.source}
                    {selectedCitation.section ? ` · ${selectedCitation.section}` : ""}
                  </strong>
                  “{selectedCitation.snippet || "Cited excerpt from the retrieved chunk."}”
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


