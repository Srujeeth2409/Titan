"use client";

import * as React from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------
// Transition Physics
// ----------------------------------------------------------------------
const SPRING_TRANSITION = "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
const SMOOTH_HEIGHT_TRANSITION = "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.15s ease-out";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------
interface Attachment {
  id: string;
  file: File;
  url: string;
  name: string;
  width?: number;
  height?: number;
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------
function MorphingText({ text }: { text: string }) {
  const [width, setWidth] = useState<number | "auto">("auto");
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (spanRef.current) {
      setWidth(spanRef.current.offsetWidth);
    }
  }, [text]);

  return (
    <span
      className="relative inline-flex items-center justify-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]"
      style={{ width }}
    >
      <span ref={spanRef} className="invisible whitespace-nowrap px-1">
        {text}
      </span>
      <span
        key={text}
        className="absolute inset-0 flex items-center justify-center whitespace-nowrap animate-in fade-in zoom-in-95 duration-300"
      >
        {text}
      </span>
    </span>
  );
}

function ModelIcon({ model, className }: { model: string; className?: string }) {
  const icons: Record<string, string> = {
    "Composer 2.5": "https://cdn.21st.dev/assets/mirror/7d/7dc00bc09f225fcda46cbc9c6b669c69c025a231877d6c17baa6a003f04f02b2.svg",
    "Gemini 3.5 Flash": "https://cdn.21st.dev/assets/mirror/cd/cda2df6631d5fa227de3fa04ed78cf354f910ba92a9f086e7455655c10ad9d09.svg",
    "GPT 5.5": "https://cdn.21st.dev/assets/mirror/b9/b93fa7942be639a1dae60194ff12141145d7d9fd59581582d6ff23335755f19c.svg",
    "Opus 4.8": "https://cdn.21st.dev/assets/mirror/5d/5de1221c77cc91e748066fd642ad0eee1c1fa65328814f5178166f901e599709.svg",
    "GLM 5.2": "https://cdn.21st.dev/assets/mirror/b2/b2a6c0ff63efd8a555edf8a174ea6fcfeca120ac1595a2d461ca11d3ae89276c.svg"
  };

  const filters: Record<string, string> = {
    "GPT 5.5": "dark:invert", 
  };

  return (
    <img 
      src={icons[model] || icons["GPT 5.5"]} 
      alt={model} 
      className={cn("object-contain", filters[model], className)} 
    />
  );
}

function ArrowUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 12V2M7 2L2.5 6.5M7 2L11.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="5" y="1" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.75 6.5V7a4.25 4.25 0 0 0 8.5 0v-.5M7 11.25V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5V11.5M2.5 7H11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DynamicBarsIcon({ level }: { level: string }) {
  const isMediumOrHigh = level === "Medium" || level === "Max Effort";
  const isHigh = level === "Max Effort";

  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="8" width="2.5" height="4.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={1} />
      <rect x="5.75" y="5" width="2.5" height="7.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={isMediumOrHigh ? 1 : 0.3} />
      <rect x="10" y="2" width="2.5" height="10.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={isHigh ? 1 : 0.3} />
    </svg>
  );
}

// ----------------------------------------------------------------------
// Attachment Thumbnail
// ----------------------------------------------------------------------
function AttachmentThumb({
  attachment,
  index,
  onRemove,
  onOpen,
  registerRef,
}: {
  attachment: Attachment;
  index: number;
  onRemove: (id: string) => void;
  onOpen: (attachment: Attachment, rect: DOMRect) => void;
  registerRef: (id: string, el: HTMLButtonElement | null) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={(el) => {
        const btnRef = useRef<HTMLButtonElement | null>(null);
        registerRef(attachment.id, el);
      }}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (btnRef.current) {
          onOpen(attachment, btnRef.current.getBoundingClientRect());
        }
      }}
      style={{
        position: "relative",
        width: 48,
        height: 48,
        flexShrink: 0,
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.15)",
        backgroundColor: "rgba(255,255,255,0.06)",
        outline: "none",
        cursor: "pointer",
        padding: 0,
        animationDelay: `${index * 35}ms`,
        animationFillMode: "backwards",
      }}
      aria-label={`Open preview of ${attachment.name}`}
    >
      <img src={attachment.url} alt={attachment.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          backgroundColor: isHovered ? "rgba(0,0,0,0.3)" : "transparent",
          transition: "background-color 200ms ease",
        }}
      >
        <span
          role="button"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); onRemove(attachment.id); }}
          style={{
            margin: 4,
            width: 16,
            height: 16,
            borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.8)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? "scale(1)" : "scale(0.5)",
            transition: "all 200ms ease",
          }}
          aria-label={`Remove ${attachment.name}`}
        >
          <CloseIcon />
        </span>
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------
// Shared-Element Gallery Modal
// ----------------------------------------------------------------------
function AttachmentGalleryModal({
  attachment,
  originRect,
  onClose,
}: {
  attachment: Attachment;
  originRect: DOMRect;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const [targetRect, setTargetRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    radius: number;
  } | null>(null);

  useEffect(() => {
    const maxW = Math.min(window.innerWidth * 0.86, 560);
    const maxH = Math.min(window.innerHeight * 0.78, 720);

    const naturalW = attachment.width || 800;
    const naturalH = attachment.height || 600;
    const scale = Math.min(maxW / naturalW, maxH / naturalH, 1.6);

    const width = naturalW * scale;
    const height = naturalH * scale;

    setTargetRect({
      top: (window.innerHeight - height) / 2,
      left: (window.innerWidth - width) / 2,
      width,
      height,
      radius: 20,
    });

    const raf = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(raf);
  }, [attachment]);

  const handleClose = useCallback(() => setPhase("closing"), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose]);

  const isOpen = phase === "open";
  const isClosing = phase === "closing";

  const geometry = isOpen && targetRect
      ? targetRect
      : { top: originRect.top, left: originRect.left, width: originRect.width, height: originRect.height, radius: 12 };

  const animEasing = isClosing ? "ease-out" : "cubic-bezier(0.175, 0.885, 0.32, 1.275)";
  const animDur = isClosing ? "0.3s" : "0.45s";
  const flipTransition = `top ${animDur} ${animEasing}, left ${animDur} ${animEasing}, width ${animDur} ${animEasing}, height ${animDur} ${animEasing}, border-radius ${animDur} ${animEasing}`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100 }} onClick={handleClose} role="dialog" aria-modal="true">
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          opacity: isOpen ? 1 : 0,
          transition: "opacity 400ms ease",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: geometry.top,
          left: geometry.left,
          width: geometry.width,
          height: geometry.height,
          borderRadius: geometry.radius,
          transition: flipTransition,
          overflow: "hidden",
          boxShadow: isOpen ? "0 24px 60px -12px rgba(0,0,0,0.5)" : "none",
        }}
        onTransitionEnd={() => { if (phase === "closing") onClose(); }}
        onClick={(e) => e.stopPropagation()}
      >
        <img src={attachment.url} alt={attachment.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
      </div>

      <button
        type="button"
        onClick={handleClose}
        style={{
          position: "fixed",
          right: 16,
          top: 16,
          width: 36,
          height: 36,
          borderRadius: "50%",
          backgroundColor: "rgba(255,255,255,0.15)",
          color: "#ffffff",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "scale(1)" : "scale(0.7)",
          transition: "all 300ms cubic-bezier(0.175,0.885,0.32,1.275)",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        <span style={{ transform: "scale(1.3)" }}><CloseIcon /></span>
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export interface PromptInputProps {
  onSubmit?: (
    value: string,
    meta: { model: string; effort: string; attachments: File[] }
  ) => void;
  placeholder?: string;
  className?: string;
  models?: string[];
  efforts?: string[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  maxAttachments?: number;
}

export const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      onSubmit,
      placeholder = "Ask anything",
      className,
      models = ["GPT 5.5", "Opus 4.8", "Gemini 3.5 Flash", "Composer 2.5", "GLM 5.2"],
      efforts = ["Low", "Medium", "Max Effort"],
      defaultValue = "",
      value: controlledValue,
      onChange,
      maxAttachments = 6,
    },
    ref
  ) => {
    const [expanded, setExpanded] = useState(false);
    const [isSmoothResize, setIsSmoothResize] = useState(false);
    const [localValue, setLocalValue] = useState(defaultValue);
    const [selectedModel, setSelectedModel] = useState(models[0]);
    const [effortIndex, setEffortIndex] = useState(1);
    const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);

    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [activeAttachment, setActiveAttachment] = useState<{ attachment: Attachment; rect: DOMRect } | null>(null);

    // Audio/Voice recording states
    const [isRecording, setIsRecording] = useState(false);
    const [audioData, setAudioData] = useState<number[]>(new Array(5).fill(0));
    const valueRef = useRef(controlledValue !== undefined ? controlledValue : localValue);

    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const rafRef = useRef<number | null>(null);
    const recognitionRef = useRef<any>(null);
    const demoIntervalRef = useRef<number | null>(null);
    const demoTextIntervalRef = useRef<number | null>(null);

    const [containerHeight, setContainerHeight] = useState(116);
    const [textareaHeight, setTextareaHeight] = useState(68);

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : localValue;
    const hasValue = value.trim() !== "" || attachments.length > 0;
    const hasAttachments = attachments.length > 0;

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const internalContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const thumbRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

    useEffect(() => {
      valueRef.current = value;
    }, [value]);

    const handleValueChange = useCallback((val: string) => {
      setIsSmoothResize(true); 
      if (!isControlled) setLocalValue(val);
      onChange?.(val);
    }, [isControlled, onChange]);

    const expand = () => {
      setIsSmoothResize(false); 
      setExpanded(true);
    };

    const stopRecording = useCallback(() => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (demoIntervalRef.current) {
        window.clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      if (demoTextIntervalRef.current) {
        window.clearInterval(demoTextIntervalRef.current);
        demoTextIntervalRef.current = null;
      }
      setIsRecording(false);
      setAudioData(new Array(5).fill(0));
    }, []);

    const startRecording = useCallback(async () => {
      setIsSmoothResize(false);
      setExpanded(true);

      let stream: MediaStream | null = null;
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      } catch (err) {
        // Fallback simulation
      }

      setIsRecording(true);

      function simulateText() {
        const fakeText = "Can you show me the real-time metrics across all active dashboards?";
        const words = fakeText.split(" ");
        let i = 0;
        let currentBase = valueRef.current;
        demoTextIntervalRef.current = window.setInterval(() => {
          if (i < words.length) {
            currentBase = (currentBase ? currentBase + " " : "") + words[i];
            handleValueChange(currentBase);
            i++;
          } else {
            stopRecording();
          }
        }, 280);
      }

      if (stream) {
        streamRef.current = stream;
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64; 
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateVisualizer = () => {
          analyser.getByteFrequencyData(dataArray);
          const bands = new Array(5).fill(0);
          const step = Math.floor(dataArray.length / 5);
          for (let i = 0; i < 5; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) {
              sum += dataArray[i * step + j];
            }
            bands[i] = sum / step / 255;
          }
          setAudioData(bands);
          rafRef.current = requestAnimationFrame(updateVisualizer);
        };
        updateVisualizer();

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;

          let baseline = valueRef.current;

          recognition.onresult = (event: any) => {
            let interimTranscript = "";
            let finalTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              } else {
                interimTranscript += event.results[i][0].transcript;
              }
            }
            
            if (finalTranscript) {
               baseline += (baseline ? " " : "") + finalTranscript;
            }
            
            handleValueChange((baseline + (interimTranscript ? " " + interimTranscript : "")).trim());
          };

          recognition.onerror = () => stopRecording();
          recognition.onend = () => stopRecording();
          recognitionRef.current = recognition;
          recognition.start();
        } else {
          simulateText();
        }
      } else {
        demoIntervalRef.current = window.setInterval(() => {
          setAudioData(Array.from({ length: 5 }, () => Math.random() * 0.8 + 0.1));
        }, 100);
        simulateText();
      }
    }, [handleValueChange, stopRecording]);

    useEffect(() => {
      if ((value.trim() !== "" || hasAttachments) && !expanded) {
        setIsSmoothResize(false);
        setExpanded(true);
      }
    }, [value, expanded, hasAttachments]);

    useEffect(() => {
      if (expanded && !isRecording) {
        const timer = setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const length = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(length, length);
          }
        }, 50);
        return () => clearTimeout(timer);
      }
    }, [expanded, isRecording]);

    useEffect(() => {
      if (!textareaRef.current) return;
      const el = textareaRef.current;
      const scrollHeight = el.scrollHeight;
      const newHeight = Math.max(68, Math.min(scrollHeight, 160));
      setTextareaHeight(newHeight);
    }, [value, expanded]); 

    useEffect(() => {
      setContainerHeight(Math.max(116, textareaHeight + 48));
    }, [textareaHeight]);

    useEffect(() => {
      if (!isModelSelectOpen) return;
      const handleOutsideClick = (e: MouseEvent) => {
        if (internalContainerRef.current && !internalContainerRef.current.contains(e.target as Node)) {
          setIsModelSelectOpen(false);
        }
      };
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [isModelSelectOpen]);

    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
      if (internalContainerRef.current && internalContainerRef.current.contains(e.relatedTarget as Node)) return;
      if (value.trim() === "" && !hasAttachments && !isRecording) {
        setIsSmoothResize(false);
        setExpanded(false);
        setIsModelSelectOpen(false);
      }
    };

    const handleSubmit = () => {
      if (value.trim() === "" && !hasAttachments) return;
      setIsSmoothResize(false);
      onSubmit?.(value, { model: selectedModel, effort: efforts[effortIndex], attachments: attachments.map((a) => a.file) });
      handleValueChange("");
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
      setAttachments([]);
      setExpanded(false);
      setIsModelSelectOpen(false);
    };

    const cycleEffort = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEffortIndex((prev) => (prev + 1) % efforts.length);
    };

    const openFileChooser = (e: React.MouseEvent) => {
      e.stopPropagation();
      fileInputRef.current?.click();
    };

    const handleFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
      e.target.value = ""; 

      if (files.length === 0) return;
      const room = Math.max(0, maxAttachments - attachments.length);
      const accepted = files.slice(0, room);

      if (!expanded) { setIsSmoothResize(false); setExpanded(true); } 
      else { setIsSmoothResize(true); }

      for (const file of accepted) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => addAttachment(file, url, img.naturalWidth, img.naturalHeight);
        img.onerror = () => addAttachment(file, url, 800, 600);
        img.src = url;
      }
    };

    const addAttachment = (file: File, url: string, width: number, height: number) => {
      const id = `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
      setAttachments((prev) => [...prev, { id, file, url, name: file.name, width, height }]);
    };

    const removeAttachment = (id: string) => {
      setIsSmoothResize(true);
      setAttachments((prev) => {
        const target = prev.find((a) => a.id === id);
        if (target) URL.revokeObjectURL(target.url);
        return prev.filter((a) => a.id !== id);
      });
      thumbRefs.current.delete(id);
    };

    const showArrow = hasValue && !isRecording;
    const showStop = isRecording;
    const showMic = !hasValue && !isRecording;

    const onActionButtonClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (isRecording) {
        stopRecording();
      } else if (hasValue) {
        handleSubmit();
      } else {
        startRecording();
      }
    };

    return (
      <>
        <div
          ref={(node) => {
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
            // @ts-ignore
            internalContainerRef.current = node;
          }}
          onBlur={handleBlur}
          className={cn("relative flex flex-col w-full", className)}
          style={{
            maxWidth: expanded ? 480 : 320,
            transition: isSmoothResize ? "max-width 0.15s ease-out" : "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            fontFamily: '"Reference Sans", Arial, sans-serif',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesChosen}
            style={{ display: "none" }}
            tabIndex={-1}
            aria-hidden="true"
          />

          {/* Slide-up Attachment Drawer */}
          <div
            aria-hidden={!hasAttachments}
            style={{
              height: hasAttachments && expanded ? 68 : 0,
              transition: isSmoothResize
                ? "height 0.15s ease-out"
                : "height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              overflow: "hidden",
              position: "relative",
              width: "100%",
              zIndex: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: -8,
                left: 20,
                right: 20,
                height: 68,
                transform: hasAttachments && expanded ? "translateY(0)" : "translateY(100%)",
                opacity: hasAttachments && expanded ? 1 : 0,
                transition: isSmoothResize
                  ? "transform 0.15s ease-out, opacity 0.15s ease-out"
                  : "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-out",
                border: "1px solid rgba(255,255,255,0.15)",
                borderBottom: "none",
                backgroundColor: "rgba(24, 24, 28, 0.95)",
                borderRadius: "16px 16px 0 0",
                padding: "8px 8px 4px 8px",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                overflowX: "auto",
              }}
            >
              {attachments.map((attachment, index) => (
                <AttachmentThumb
                  key={attachment.id}
                  attachment={attachment}
                  index={index}
                  onRemove={removeAttachment}
                  onOpen={(a, rect) => setActiveAttachment({ attachment: a, rect })}
                  registerRef={(id, el) => thumbRefs.current.set(id, el)}
                />
              ))}
            </div>
          </div>

          {/* Main Input Card */}
          <div
            onMouseDown={(e) => {
              const isTextarea = e.target === textareaRef.current;
              if (expanded && !isTextarea && !isRecording) {
                e.preventDefault();
                textareaRef.current?.focus();
              }
            }}
            style={{
              position: "relative",
              width: "100%",
              borderRadius: 24,
              height: expanded ? containerHeight : 48,
              transition: isSmoothResize ? SMOOTH_HEIGHT_TRANSITION : SPRING_TRANSITION,
              overflow: expanded ? "visible" : "hidden",
              backgroundColor: "rgba(18, 18, 22, 0.88)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(20px) saturate(110%)",
              WebkitBackdropFilter: "blur(20px) saturate(110%)",
              zIndex: 10,
              cursor: expanded ? "text" : "default",
            }}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
                if (e.key === "Escape" && value.trim() === "" && !hasAttachments) {
                  setIsSmoothResize(false);
                  setExpanded(false);
                  setIsModelSelectOpen(false);
                }
              }}
              placeholder={placeholder}
              aria-label="Prompt"
              disabled={isRecording}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1,
                width: "100%",
                height: `${textareaHeight}px`,
                resize: "none",
                background: "transparent",
                padding: "14px 48px 14px 16px",
                fontSize: "14px",
                lineHeight: "22px",
                color: "#ffffff",
                outline: "none",
                border: "none",
                fontFamily: "inherit",
                opacity: expanded ? 1 : 0,
                transform: expanded ? "scale(1) translateY(0)" : "scale(0.95) translateY(-4px)",
                pointerEvents: expanded && !isRecording ? "auto" : "none",
                transition: isSmoothResize
                  ? "height 0.15s ease-out"
                  : "opacity 0.3s ease-out, transform 0.3s ease-out, height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              }}
            />

            <button
              type="button"
              onClick={expand}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 1,
                cursor: "text",
                padding: "15px 48px 15px 16px",
                textAlign: "left",
                fontSize: "14px",
                fontWeight: 500,
                lineHeight: "17px",
                color: "rgba(255, 255, 255, 0.65)",
                background: "transparent",
                border: "none",
                outline: "none",
                opacity: !expanded ? 1 : 0,
                transform: !expanded ? "scale(1) translateY(0)" : "scale(1.05) translateY(4px)",
                pointerEvents: !expanded ? "auto" : "none",
                transition: isSmoothResize ? "none" : "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              }}
              aria-label="Open prompt input"
            >
              {placeholder}
            </button>

            {/* Bottom Actions Wrapper */}
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: 12,
                right: 48,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                gap: 4,
                opacity: expanded && !isRecording ? 1 : 0,
                filter: expanded && !isRecording ? "blur(0)" : "blur(4px)",
                transform: expanded && !isRecording ? "translateY(0)" : "translateY(8px)",
                pointerEvents: expanded && !isRecording ? "auto" : "none",
                transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              }}
            >
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModelSelectOpen((prev) => !prev);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    borderRadius: 9999,
                    padding: "4px 8px",
                    color: "rgba(255, 255, 255, 0.7)",
                    backgroundColor: isModelSelectOpen ? "rgba(255, 255, 255, 0.12)" : "transparent",
                    border: "none",
                    outline: "none",
                    cursor: "pointer",
                    transition: "all 200ms ease",
                  }}
                  aria-label={`Select model. Current: ${selectedModel}`}
                >
                  <ModelIcon model={selectedModel} className="size-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                    <MorphingText text={selectedModel} />
                  </span>
                </button>

                {isModelSelectOpen && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 10px)",
                      left: 0,
                      width: 176,
                      backgroundColor: "rgba(22, 22, 26, 0.96)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: 16,
                      padding: 4,
                      boxShadow: "0 16px 40px rgba(0, 0, 0, 0.7)",
                      backdropFilter: "blur(16px)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      zIndex: 100,
                    }}
                  >
                    {models.map((model) => (
                      <button
                        key={model}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedModel(model);
                          setIsModelSelectOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 10px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 500,
                          color: selectedModel === model ? "#ffffff" : "rgba(255, 255, 255, 0.8)",
                          backgroundColor: selectedModel === model ? "rgba(255, 255, 255, 0.12)" : "transparent",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 150ms ease",
                        }}
                      >
                        <ModelIcon model={model} className="size-3.5 opacity-85" />
                        <span>{model}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={cycleEffort}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  borderRadius: 9999,
                  padding: "4px 8px",
                  color: "rgba(255, 255, 255, 0.7)",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <DynamicBarsIcon level={efforts[effortIndex]} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                  <MorphingText text={efforts[effortIndex]} />
                </span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={openFileChooser}
                disabled={attachments.length >= maxAttachments}
                style={{
                  marginLeft: "auto",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  color: "rgba(255, 255, 255, 0.7)",
                  backgroundColor: "transparent",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <PlusIcon />
              </button>
            </div>

            {/* Audio Wave Visualizer Overlay */}
            <div
              style={{
                position: "absolute",
                right: 48,
                bottom: 8,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 3,
                opacity: isRecording ? 1 : 0,
                pointerEvents: "none",
                transition: "opacity 300ms ease",
              }}
            >
              {audioData.map((val, i) => (
                <div
                  key={i}
                  style={{
                    width: 3,
                    borderRadius: 9999,
                    backgroundColor: "#ffffff",
                    height: `${Math.max(4, val * 24)}px`,
                    transition: "height 75ms ease-out",
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} 
              onClick={onActionButtonClick}
              aria-label={showArrow ? "Send prompt" : showStop ? "Stop recording" : "Use voice input"}
              style={{
                position: "absolute",
                right: 8,
                bottom: 8,
                zIndex: 10,
                width: 32,
                height: 32,
                borderRadius: 9999,
                backgroundColor: "#ffffff",
                color: "#000000",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                outline: "none",
                transition: "all 300ms cubic-bezier(0.175,0.885,0.32,1.275)",
              }}
            >
              <span style={{ position: "relative", display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
                <span style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: showArrow ? 1 : 0,
                  transform: showArrow ? "scale(1)" : "scale(0.5) rotate(45deg)",
                  transition: "all 300ms cubic-bezier(0.175,0.885,0.32,1.275)",
                  pointerEvents: showArrow ? "auto" : "none",
                }}>
                  <ArrowUpIcon />
                </span>
                <span style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: showMic ? 1 : 0,
                  transform: showMic ? "scale(1)" : "scale(0.5) rotate(-45deg)",
                  transition: "all 300ms cubic-bezier(0.175,0.885,0.32,1.275)",
                  pointerEvents: showMic ? "auto" : "none",
                }}>
                  <MicIcon />
                </span>
                <span style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: showStop ? 1 : 0,
                  transform: showStop ? "scale(1)" : "scale(0.5) rotate(45deg)",
                  transition: "all 300ms cubic-bezier(0.175,0.885,0.32,1.275)",
                  pointerEvents: showStop ? "auto" : "none",
                }}>
                  <StopIcon />
                </span>
              </span>
            </button>
          </div>
        </div>

        {activeAttachment && (
          <AttachmentGalleryModal
            attachment={activeAttachment.attachment}
            originRect={activeAttachment.rect}
            onClose={() => setActiveAttachment(null)}
          />
        )}
      </>
    );
  }
);

PromptInput.displayName = "PromptInput";
