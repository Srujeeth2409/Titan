"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  ReactNode,
} from "react";
import { askStream, TitanApiError } from "@/lib/api";
import {
  ChatMessage,
  getStoredConversations,
  saveStoredConversations,
} from "@/lib/chat-store";
import { Citation, Confidence, HallucinationInfo } from "@/components/ask-box";
import {
  exportToPdf,
  exportToDocx,
  detectExportIntent,
} from "@/lib/document-exporter";

export interface BackgroundQueryContextType {
  isRunning: boolean;
  runningConvoId: string | null;
  runningConvoTitle: string | null;
  query: string;
  streamingAnswer: string;
  streamingSteps: { step: string; status: "started" | "completed" }[];
  streamingCitations: Citation[];
  streamingConfidence: Confidence | null;
  streamingHallucination: HallucinationInfo | null;
  streamingError: { message: string; code?: string } | null;
  startQuery: (params: {
    convoId: string;
    query: string;
    collection: string;
    selectedModel: string;
    selectedMode: "Fast" | "Medium" | "Deep";
    provider?: string;
    modelId?: string;
  }) => Promise<void>;
  cancelQuery: () => void;
}

const BackgroundQueryContext = createContext<BackgroundQueryContextType | null>(null);

export function BackgroundQueryProvider({ children }: { children: ReactNode }) {
  const [isRunning, setIsRunning] = useState(false);
  const [runningConvoId, setRunningConvoId] = useState<string | null>(null);
  const [runningConvoTitle, setRunningConvoTitle] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [streamingSteps, setStreamingSteps] = useState<{ step: string; status: "started" | "completed" }[]>([]);
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [streamingConfidence, setStreamingConfidence] = useState<Confidence | null>(null);
  const [streamingHallucination, setStreamingHallucination] = useState<HallucinationInfo | null>(null);
  const [streamingError, setStreamingError] = useState<{ message: string; code?: string } | null>(null);

  const activeReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Background tab title notification
  useEffect(() => {
    const originalTitle = typeof document !== "undefined" ? document.title : "Titan RAG";
    if (isRunning) {
      document.title = "● Synthesizing answer… | Titan";
    } else {
      document.title = "Titan — Enterprise RAG Workstation";
    }
    return () => {
      if (typeof document !== "undefined") document.title = originalTitle;
    };
  }, [isRunning]);

  const cancelQuery = () => {
    isCancelledRef.current = true;
    if (activeReaderRef.current) {
      try {
        activeReaderRef.current.cancel();
      } catch {}
      activeReaderRef.current = null;
    }
    setIsRunning(false);
    setRunningConvoId(null);
  };

  const startQuery = async (params: {
    convoId: string;
    query: string;
    collection: string;
    selectedModel: string;
    selectedMode: "Fast" | "Medium" | "Deep";
    provider?: string;
    modelId?: string;
  }) => {
    const { convoId, query: userQuery, collection, selectedModel, selectedMode, provider, modelId } = params;
    const cleanQuery = userQuery.trim();
    if (!cleanQuery || isRunning) return;

    isCancelledRef.current = false;
    const allConvos = getStoredConversations();
    const currentConvo = allConvos.find((c) => c.id === convoId);
    if (!currentConvo) return;

    const isFirstMessage = currentConvo.messages.length === 0;
    const autoTitle = isFirstMessage
      ? cleanQuery.slice(0, 42) + (cleanQuery.length > 42 ? "…" : "")
      : currentConvo.title;

    // 1. Append user message
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: cleanQuery,
      createdAt: new Date().toISOString(),
      model: selectedModel,
      collection,
    };

    // Check for document export intent
    const exportIntent = detectExportIntent(cleanQuery);
    const lastAssistantMsg = [...currentConvo.messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content && !m.exportAttachment);

    if (exportIntent.isExport && lastAssistantMsg) {
      const docTitle = currentConvo.title === "New Chat" ? "Titan_Document" : currentConvo.title;

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
      return;
    }

    // Standard RAG Retrieval Path — runs globally in background
    const updatedConvoWithUser = {
      ...currentConvo,
      title: currentConvo.title === "New Chat" ? autoTitle : currentConvo.title,
      messages: [...currentConvo.messages, userMsg],
      updatedAt: new Date().toISOString(),
    };

    saveStoredConversations(
      allConvos.map((c) => (c.id === currentConvo.id ? updatedConvoWithUser : c))
    );

    setIsRunning(true);
    setRunningConvoId(convoId);
    setRunningConvoTitle(updatedConvoWithUser.title);
    setQuery(cleanQuery);
    setStreamingAnswer("");
    setStreamingSteps([{ step: "Query analysis & embedding generation", status: "started" }]);
    setStreamingCitations([]);
    setStreamingConfidence(null);
    setStreamingHallucination(null);
    setStreamingError(null);

    const apiMode = selectedMode === "Fast" ? "single" : selectedMode === "Deep" ? "agentic" : "auto";

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
        cleanQuery,
        collection,
        apiMode,
        provider,
        modelId
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
      activeReaderRef.current = reader;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (isCancelledRef.current) break;

        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (isCancelledRef.current) break;
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
      if (!isCancelledRef.current) {
        finalError = { message: err.message || "Failed to execute query against Titan backend." };
        setStreamingError(finalError);
      }
    } finally {
      activeReaderRef.current = null;
      setIsRunning(false);
      setRunningConvoId(null);
      setRunningConvoTitle(null);

      if (!isCancelledRef.current) {
        finalSteps = finalSteps.map((s) => ({ ...s, status: "completed" }));

        // Append finalized assistant message to the conversation
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
      }

      setStreamingAnswer("");
      setStreamingSteps([]);
    }
  };

  return (
    <BackgroundQueryContext.Provider
      value={{
        isRunning,
        runningConvoId,
        runningConvoTitle,
        query,
        streamingAnswer,
        streamingSteps,
        streamingCitations,
        streamingConfidence,
        streamingHallucination,
        streamingError,
        startQuery,
        cancelQuery,
      }}
    >
      {children}
    </BackgroundQueryContext.Provider>
  );
}

export function useBackgroundQuery() {
  const ctx = useContext(BackgroundQueryContext);
  if (!ctx) {
    throw new Error("useBackgroundQuery must be used within a BackgroundQueryProvider");
  }
  return ctx;
}
