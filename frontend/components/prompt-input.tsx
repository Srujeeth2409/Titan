"use client";

/**
 * PromptInput: self-contained chatbox (UI only).
 *
 * Styled with plain CSS (injected below), so it does NOT need Tailwind,
 * shadcn, tailwindcss-animate or any extra dependency. All class names are
 * prefixed with "pi-" so they can't collide with the rest of your styles.
 */

import * as React from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

// ----------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------
const STYLES = `
.pi-root, .pi-modal {
  --pi-card: rgba(18, 18, 20, 0.74);
  --pi-solid: #141416;
  --pi-muted: rgba(255, 255, 255, 0.08);
  --pi-border: rgba(255, 255, 255, 0.14);
  --pi-border-strong: rgba(255, 255, 255, 0.3);
  --pi-fg: #ffffff;
  --pi-fg-dim: rgba(255, 255, 255, 0.55);
  --pi-hover: rgba(255, 255, 255, 0.1);
  --pi-primary: #ffffff;
  --pi-primary-fg: #0b0b0c;
  --pi-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  color: var(--pi-fg);
}

:where(.pi-root, .pi-modal) * { box-sizing: border-box; }
:where(.pi-root, .pi-modal) button {
  font-family: inherit;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  cursor: default;
  outline: none;
}

.pi-root {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0 auto;
}

/* Attachment tab (slides up from behind the card) */
.pi-tab { position: relative; z-index: 0; width: 100%; overflow: hidden; }
.pi-tab-inner {
  position: absolute;
  left: 20px; right: 20px; bottom: -8px;
  height: 68px;
  display: flex; align-items: flex-start; gap: 8px;
  padding: 8px 8px 4px;
  overflow-x: auto;
  background: rgba(30, 30, 33, 0.92);
  border: 1px solid var(--pi-border);
  border-bottom: 0;
  border-radius: 16px 16px 0 0;
}

.pi-thumb {
  position: relative;
  flex-shrink: 0;
  width: 48px; height: 48px;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--pi-border);
  background: var(--pi-muted);
  transition: transform 0.2s var(--pi-spring);
  animation: pi-thumb-in 0.4s var(--pi-spring);
}
.pi-thumb:hover { transform: scale(1.04); }
.pi-thumb:active { transform: scale(0.96); }
.pi-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.pi-thumb-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: flex-start; justify-content: flex-end;
  background: rgba(0, 0, 0, 0);
  transition: background 0.2s;
}
.pi-thumb.hovered .pi-thumb-overlay { background: rgba(0, 0, 0, 0.3); }
.pi-thumb-x {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; margin: 4px;
  border-radius: 50%;
  background: rgba(20, 20, 22, 0.92);
  color: rgba(255, 255, 255, 0.75);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  opacity: 0; transform: scale(0.5); pointer-events: none;
  transition: all 0.2s var(--pi-spring);
}
.pi-thumb.hovered .pi-thumb-x { opacity: 1; transform: scale(1); pointer-events: auto; }
.pi-thumb-x:hover { background: #000; color: #fff; transform: scale(1.1) !important; }

/* Card */
.pi-card {
  position: relative;
  z-index: 10;
  width: 100%;
  border: 1px solid var(--pi-border);
  border-radius: 24px;
  background: var(--pi-card);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
  backdrop-filter: blur(18px) saturate(1.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  transition-property: border-color, box-shadow;
  transition-duration: 0.2s;
}
.pi-card:hover { border-color: rgba(255, 255, 255, 0.22); }
.pi-card:focus-within {
  border-color: var(--pi-border-strong);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 3px rgba(255, 255, 255, 0.06);
}
.pi-card.is-expanded { cursor: text; }

.pi-textarea {
  position: absolute; top: 0; left: 0; right: 0; z-index: 1;
  display: block;
  width: 100%;
  resize: none;
  background: transparent;
  border: 0; outline: none;
  padding: 14px 48px 14px 16px;
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
  color: var(--pi-fg);
  cursor: text;
  overflow-y: hidden;
}
.pi-textarea.scrolling { overflow-y: auto; }
.pi-textarea::placeholder { color: var(--pi-fg-dim); font-weight: 500; }
.pi-textarea.hidden {
  opacity: 0;
  transform: translateY(-4px) scale(0.95);
  pointer-events: none;
}
.pi-textarea.recording { pointer-events: none; }

.pi-scroll::-webkit-scrollbar { width: 4px; height: 4px; background: transparent; }
.pi-scroll::-webkit-scrollbar-track { background: transparent; }
.pi-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; }
.pi-scroll:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.25); }

.pi-fade {
  position: absolute; left: 16px; right: 48px; z-index: 2;
  height: 32px;
  pointer-events: none;
}
.pi-fade-top { top: 0; background: linear-gradient(to bottom, rgba(20, 20, 22, 0.95), transparent); }
.pi-fade-bottom { background: linear-gradient(to top, rgba(20, 20, 22, 0.95), transparent); }

.pi-collapsed {
  position: absolute; top: 0; bottom: 0; left: 0; right: 0; z-index: 1;
  display: flex; align-items: center;
  padding: 0 48px 0 18px;
  text-align: left;
  font-size: 14px; font-weight: 500; line-height: 20px;
  color: var(--pi-fg-dim);
  cursor: text;
}
.pi-collapsed.hidden {
  opacity: 0;
  transform: translateY(4px) scale(1.05);
  pointer-events: none;
}

/* Bottom action row */
.pi-actions {
  position: absolute; z-index: 10;
  left: 12px; right: 48px; bottom: 8px;
  display: flex; align-items: center;
  transition: all 0.3s var(--pi-spring);
}
.pi-actions.hidden {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(8px);
  pointer-events: none;
}

.pi-pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px;
  border-radius: 9999px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s;
}
.pi-pill:hover, .pi-pill.open { background: var(--pi-hover); color: var(--pi-fg); }
.pi-pill-label { font-size: 12px; font-weight: 600; user-select: none; line-height: 1; }

.pi-model-icon {
  display: block;
  width: 14px; height: 14px;
  max-width: none;
  object-fit: contain;
  opacity: 0.75;
  transition: opacity 0.2s;
}
.pi-model-icon.invert { filter: invert(1); }
.pi-pill:hover .pi-model-icon, .pi-menu-item:hover .pi-model-icon { opacity: 1; }

.pi-morph {
  position: relative;
  display: inline-flex; align-items: center; justify-content: center;
  overflow: hidden;
  transition: width 0.3s var(--pi-spring);
}
.pi-morph-ghost { visibility: hidden; white-space: nowrap; padding: 0 4px; }
.pi-morph-live {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  white-space: nowrap;
  animation: pi-pop 0.3s ease-out;
}

.pi-bars rect { transition: opacity 0.3s; }

.pi-add {
  margin-left: auto;
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s;
}
.pi-add:hover { background: var(--pi-hover); color: var(--pi-fg); }
.pi-add:disabled { opacity: 0.4; pointer-events: none; }

/* Model dropdown */
.pi-menu-wrap { position: relative; }
.pi-menu {
  position: absolute; z-index: 50;
  left: 0; bottom: 100%;
  width: 176px;
  margin-bottom: 10px;
  padding: 4px;
  display: flex; flex-direction: column; gap: 2px;
  border: 1px solid var(--pi-border);
  border-radius: 16px;
  background: rgba(22, 22, 24, 0.96);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
  transform-origin: bottom left;
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  opacity: 0;
  transform: translateY(12px) scale(0.95);
  pointer-events: none;
}
.pi-menu.open { opacity: 1; transform: none; pointer-events: auto; }
.pi-menu-list { position: relative; display: flex; flex-direction: column; gap: 2px; }
.pi-menu-hl {
  position: absolute; z-index: 0;
  left: 0; right: 0; top: 0; height: 32px;
  border-radius: 12px;
  background: var(--pi-hover);
  pointer-events: none;
}
.pi-menu-item {
  position: relative; z-index: 1;
  display: flex; align-items: center; gap: 8px;
  width: 100%; height: 32px;
  padding: 6px 10px;
  border-radius: 12px;
  text-align: left;
  font-size: 12px; font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  transition: transform 0.15s;
}
.pi-menu-item:active { transform: scale(0.98); }

/* Voice visualizer */
.pi-wave {
  position: absolute; z-index: 10;
  right: 48px; bottom: 8px;
  height: 32px;
  display: flex; align-items: center; justify-content: flex-end; gap: 3px;
  width: 0; opacity: 0; transform: translateX(16px);
  pointer-events: none;
  transition: all 0.4s var(--pi-spring);
}
.pi-wave.on { width: 64px; opacity: 1; transform: none; }
.pi-wave-bar {
  width: 4px;
  border-radius: 9999px;
  background: var(--pi-primary);
  transition: height 0.075s ease-out;
}

/* Send / mic / stop button */
.pi-send {
  position: absolute; z-index: 10;
  right: 8px; bottom: 8px;
  width: 32px; height: 32px;
  border-radius: 9999px;
  background: var(--pi-primary);
  color: var(--pi-primary-fg);
  transition: all 0.3s;
}
.pi-send:hover { opacity: 0.9; }
.pi-send:focus-visible { box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35); }
.pi-send-icon {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transform: scale(0.5) rotate(45deg); filter: blur(1px);
  pointer-events: none;
  transition: all 0.3s var(--pi-spring);
}
.pi-send-icon.neg { transform: scale(0.5) rotate(-45deg); }
.pi-send-icon.on { opacity: 1; transform: none; filter: none; }

/* Gallery modal */
.pi-modal { position: fixed; inset: 0; z-index: 1000; }
.pi-modal-backdrop {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.7);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  transition: opacity 0.4s;
}
.pi-modal-box { position: fixed; overflow: hidden; background: var(--pi-muted); }
.pi-modal-box img { display: block; width: 100%; height: 100%; object-fit: cover; }
.pi-modal-close {
  position: fixed; top: 16px; right: 16px;
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border-radius: 50%;
  background: rgba(30, 30, 33, 0.92);
  color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transition: all 0.3s var(--pi-spring);
}
.pi-modal-close:hover { color: #fff; background: #000; }
.pi-modal-close.hidden { pointer-events: none; }

@keyframes pi-pop {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes pi-thumb-in {
  from { opacity: 0; transform: translateY(-12px) scale(0.9); }
  to { opacity: 1; transform: none; }
}
`;

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
    const ghostRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (ghostRef.current) {
            setWidth(ghostRef.current.offsetWidth);
        }
    }, [text]);

    return (
        <span className="pi-morph" style={{ width }}>
      <span ref={ghostRef} className="pi-morph-ghost">
        {text}
      </span>
      <span key={text} className="pi-morph-live">
        {text}
      </span>
    </span>
    );
}

function ModelIcon({ model }: { model: string }) {
    const icons: Record<string, string> = {
        "Composer 2.5": "https://cdn.21st.dev/assets/mirror/7d/7dc00bc09f225fcda46cbc9c6b669c69c025a231877d6c17baa6a003f04f02b2.svg",
        "Gemini 3.5 Flash": "https://cdn.21st.dev/assets/mirror/cd/cda2df6631d5fa227de3fa04ed78cf354f910ba92a9f086e7455655c10ad9d09.svg",
        "GPT 5.5": "https://cdn.21st.dev/assets/mirror/b9/b93fa7942be639a1dae60194ff12141145d7d9fd59581582d6ff23335755f19c.svg",
        "Opus 4.8": "https://cdn.21st.dev/assets/mirror/5d/5de1221c77cc91e748066fd642ad0eee1c1fa65328814f5178166f901e599709.svg",
        "GLM 5.2": "https://cdn.21st.dev/assets/mirror/b2/b2a6c0ff63efd8a555edf8a174ea6fcfeca120ac1595a2d461ca11d3ae89276c.svg",
    };

    // The GPT logo is black on transparent, so it is inverted on this dark card
    const invert = model === "GPT 5.5";

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={icons[model] || icons["GPT 5.5"]}
            alt={model}
            width={14}
            height={14}
            className={`pi-model-icon${invert ? " invert" : ""}`}
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

function CloseIcon({ size = 9 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function DynamicBarsIcon({ level }: { level: string }) {
    const isMediumOrHigh = level === "Medium" || level === "Max Effort";
    const isHigh = level === "Max Effort";

    return (
        <svg className="pi-bars" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="1.5" y="8" width="2.5" height="4.5" rx="1" fill="currentColor" opacity={1} />
            <rect x="5.75" y="5" width="2.5" height="7.5" rx="1" fill="currentColor" opacity={isMediumOrHigh ? 1 : 0.3} />
            <rect x="10" y="2" width="2.5" height="10.5" rx="1" fill="currentColor" opacity={isHigh ? 1 : 0.3} />
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
    const btnRef = useRef<HTMLButtonElement | null>(null);

    return (
        <button
            ref={(el) => {
                btnRef.current = el;
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
            style={{ animationDelay: `${index * 35}ms`, animationFillMode: "backwards" }}
            className={`pi-thumb${isHovered ? " hovered" : ""}`}
            aria-label={`Open preview of ${attachment.name}`}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment.url} alt={attachment.name} draggable={false} />
            <span className="pi-thumb-overlay">
        <span
            role="button"
            tabIndex={-1}
            className="pi-thumb-x"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); onRemove(attachment.id); }}
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

    // Portal to <body> so "position: fixed" is relative to the real viewport
    return createPortal(
        <div className="pi-modal" onClick={handleClose} role="dialog" aria-modal="true">
            <div className="pi-modal-backdrop" style={{ opacity: isOpen ? 1 : 0 }} />
            <div
                className="pi-modal-box"
                style={{
                    top: geometry.top,
                    left: geometry.left,
                    width: geometry.width,
                    height: geometry.height,
                    borderRadius: geometry.radius,
                    transition: flipTransition,
                    boxShadow: isOpen ? "0 24px 60px -12px rgb(0 0 0 / 0.5)" : "0 0 0 0 rgb(0 0 0 / 0)",
                }}
                onTransitionEnd={() => { if (phase === "closing") onClose(); }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={attachment.url} alt={attachment.name} draggable={false} />
            </div>

            <button
                type="button"
                onClick={handleClose}
                className={`pi-modal-close${isOpen ? "" : " hidden"}`}
                style={{ opacity: isOpen ? 1 : 0, transform: isOpen ? "scale(1)" : "scale(0.7)" }}
                aria-label="Close preview"
            >
                <CloseIcon size={14} />
            </button>
        </div>,
        document.body
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

        // Refs for Web Audio & Speech Recognition cleanup
        const streamRef = useRef<MediaStream | null>(null);
        const audioContextRef = useRef<AudioContext | null>(null);
        const rafRef = useRef<number | null>(null);
        const recognitionRef = useRef<any>(null);
        const demoIntervalRef = useRef<number | null>(null);
        const demoTextIntervalRef = useRef<number | null>(null);

        const [hoverStyle, setHoverStyle] = useState<React.CSSProperties>({
            opacity: 0,
            transform: "translateY(0px) scale(0.95)",
            transition: "none",
        });
        const [containerHeight, setContainerHeight] = useState(116);
        const [textareaHeight, setTextareaHeight] = useState(68);
        const [isScrolling, setIsScrolling] = useState(false);

        const isControlled = controlledValue !== undefined;
        const value = isControlled ? controlledValue : localValue;
        const hasValue = value.trim() !== "" || attachments.length > 0;
        const hasAttachments = attachments.length > 0;

        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const internalContainerRef = useRef<HTMLDivElement | null>(null);
        const topFadeRef = useRef<HTMLDivElement>(null);
        const bottomFadeRef = useRef<HTMLDivElement>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);
        const thumbRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
        const attachmentsRef = useRef<Attachment[]>([]);

        // Sync value ref for audio callback closure
        useEffect(() => {
            valueRef.current = value;
        }, [value]);

        // Latest attachments for unmount cleanup (so URLs aren't revoked on every change)
        useEffect(() => {
            attachmentsRef.current = attachments;
        }, [attachments]);

        const updateFades = () => {
            const el = textareaRef.current;
            if (!el) return;
            const { scrollTop, scrollHeight, clientHeight } = el;
            if (topFadeRef.current) {
                topFadeRef.current.style.opacity = Math.min(scrollTop / 20, 1).toString();
            }
            if (bottomFadeRef.current) {
                const bottomScroll = scrollHeight - clientHeight - scrollTop;
                bottomFadeRef.current.style.opacity = Math.min(Math.max(bottomScroll - 16, 0) / 10, 1).toString();
            }
        };

        const handleValueChange = useCallback((val: string) => {
            setIsSmoothResize(true);
            if (!isControlled) setLocalValue(val);
            onChange?.(val);
        }, [isControlled, onChange]);

        const expand = () => {
            setIsSmoothResize(false);
            setExpanded(true);
        };

        // --- Voice Recording Logic ---
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
                console.warn("Microphone access denied or unavailable. Falling back to simulated voice mode for demo.");
            }

            setIsRecording(true);

            // Simulation function for environments without a microphone
            function simulateText() {
                const fakeText = "Can you build a high fidelity Framer Motion layout animation for a dark mode dashboard?";
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
                }, 300);
            }

            if (stream) {
                streamRef.current = stream;

                // Web Audio API for the visualizer
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
                        bands[i] = sum / step / 255; // normalize to 0-1
                    }
                    setAudioData(bands);
                    rafRef.current = requestAnimationFrame(updateVisualizer);
                };
                updateVisualizer();

                // Speech Recognition
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

                    recognition.onerror = (e: any) => {
                        console.error("Speech recognition error", e);
                        stopRecording();
                    };

                    recognition.onend = () => {
                        stopRecording();
                    };

                    recognitionRef.current = recognition;
                    recognition.start();
                } else {
                    console.warn("Speech Recognition API not supported in this browser. Using simulated text.");
                    simulateText();
                }
            } else {
                // Fallback simulated visualizer
                demoIntervalRef.current = window.setInterval(() => {
                    setAudioData(Array.from({ length: 5 }, () => Math.random() * 0.8 + 0.1));
                }, 100);
                simulateText();
            }
        }, [handleValueChange, stopRecording]);

        // Keep textarea auto-scrolled to bottom while recording
        useEffect(() => {
            if (isRecording && textareaRef.current) {
                textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
            }
        }, [value, isRecording]);

        // Cleanup of mic/streams and image URLs on unmount only
        useEffect(() => {
            return () => {
                stopRecording();
                attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url));
            };
        }, [stopRecording]);

        useEffect(() => {
            if ((value.trim() !== "" || hasAttachments) && !expanded) {
                setIsSmoothResize(false);
                setExpanded(true);
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
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

        // Only updates height on text change; attachments stay isolated from this.
        useEffect(() => {
            if (!textareaRef.current) return;
            const el = textareaRef.current;

            const currentHeight = el.style.height;
            el.style.transition = "none";
            el.style.height = "0px";
            const scrollHeight = el.scrollHeight;
            el.style.height = currentHeight;
            void el.offsetHeight;
            el.style.transition = "";

            const newHeight = Math.max(68, Math.min(scrollHeight, 160));
            el.style.height = `${newHeight}px`;

            setTextareaHeight(newHeight);
            setIsScrolling(scrollHeight > 160);

            setTimeout(updateFades, 0);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [value, expanded]);

        useEffect(() => {
            setContainerHeight(Math.max(116, textareaHeight + 48));
            setTimeout(updateFades, 0);
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

        const addAttachment = (file: File, url: string, width: number, height: number) => {
            const id = `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
            setAttachments((prev) => [...prev, { id, file, url, name: file.name, width, height }]);
        };

        const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const removeAttachment = (id: string) => {
            setIsSmoothResize(true);
            setAttachments((prev) => {
                const target = prev.find((a) => a.id === id);
                if (target) URL.revokeObjectURL(target.url);
                return prev.filter((a) => a.id !== id);
            });
            thumbRefs.current.delete(id);
        };

        // Action button states
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

        const showTab = hasAttachments && expanded;

        return (
            <>
                <style dangerouslySetInnerHTML={{ __html: STYLES }} />

                <div
                    ref={(node) => {
                        if (typeof ref === "function") ref(node);
                        else if (ref) ref.current = node;
                        internalContainerRef.current = node;
                    }}
                    onBlur={handleBlur}
                    className={`pi-root${className ? " " + className : ""}`}
                    style={{
                        maxWidth: expanded ? 480 : 320,
                        transition: isSmoothResize
                            ? "max-width 0.15s ease-out"
                            : "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
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

                    {/* Attachment tab (slides up from behind the card) */}
                    <div
                        className="pi-tab"
                        aria-hidden={!hasAttachments}
                        style={{
                            height: showTab ? 68 : 0,
                            transition: isSmoothResize
                                ? "height 0.15s ease-out"
                                : "height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                        }}
                    >
                        <div
                            className="pi-tab-inner pi-scroll"
                            style={{
                                transform: showTab ? "translateY(0)" : "translateY(100%)",
                                opacity: showTab ? 1 : 0,
                                transition: isSmoothResize
                                    ? "transform 0.15s ease-out, opacity 0.15s ease-out"
                                    : "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-out",
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

                    {/* Main input card */}
                    <div
                        className={`pi-card${expanded ? " is-expanded" : ""}`}
                        onMouseDown={(e) => {
                            const isTextarea = e.target === textareaRef.current;
                            if (expanded && !isTextarea && !isRecording) {
                                e.preventDefault();
                                textareaRef.current?.focus();
                            }
                        }}
                        style={{
                            height: expanded ? containerHeight : 48,
                            overflow: expanded ? "visible" : "hidden",
                            transition: `${isSmoothResize ? SMOOTH_HEIGHT_TRANSITION : SPRING_TRANSITION}, border-color 0.2s, box-shadow 0.2s`,
                        }}
                    >
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => handleValueChange(e.target.value)}
                onScroll={updateFades}
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
                className={[
                    "pi-textarea pi-scroll",
                    expanded ? "" : "hidden",
                    isScrolling ? "scrolling" : "",
                    isRecording ? "recording" : "",
                ].join(" ").trim()}
                style={{
                    transition: isSmoothResize
                        ? "height 0.15s ease-out"
                        : "opacity 0.3s ease-out, transform 0.3s ease-out, height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                }}
            />

                        <div ref={topFadeRef} className="pi-fade pi-fade-top" />
                        <div
                            ref={bottomFadeRef}
                            className="pi-fade pi-fade-bottom"
                            style={{
                                opacity: 0,
                                top: `${textareaHeight - 32}px`,
                                transition: isSmoothResize
                                    ? "top 0.15s ease-out"
                                    : "top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                            }}
                        />

                        {/* Collapsed placeholder button */}
                        <button
                            type="button"
                            onClick={expand}
                            className={`pi-collapsed${expanded ? " hidden" : ""}`}
                            style={{ transition: isSmoothResize ? "none" : "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
                            aria-label="Open prompt input"
                        >
                            {placeholder}
                        </button>

                        {/* Bottom actions: hidden while recording to make space for the visualizer */}
                        <div className={`pi-actions${expanded && !isRecording ? "" : " hidden"}`}>
                            <div className="pi-menu-wrap">
                                <button
                                    type="button"
                                    className={`pi-pill${isModelSelectOpen ? " open" : ""}`}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsModelSelectOpen((prev) => !prev);
                                    }}
                                    aria-label={`Select model. Current: ${selectedModel}`}
                                >
                                    <ModelIcon model={selectedModel} />
                                    <span className="pi-pill-label">
                    <MorphingText text={selectedModel} />
                  </span>
                                </button>

                                <div
                                    className={`pi-menu${isModelSelectOpen ? " open" : ""}`}
                                    onMouseLeave={() => {
                                        setHoverStyle((prev) => ({
                                            ...prev,
                                            opacity: 0,
                                            transform: String(prev.transform ?? "").replace("scale(1)", "scale(0.95)"),
                                            transition: "opacity 0.2s ease-in, transform 0.2s ease-out",
                                        }));
                                    }}
                                >
                                    <div className="pi-menu-list">
                                        <div className="pi-menu-hl" style={hoverStyle} />
                                        {models.map((model, idx) => (
                                            <button
                                                key={model}
                                                type="button"
                                                className="pi-menu-item"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onMouseEnter={() => {
                                                    setHoverStyle((prev) => ({
                                                        opacity: 1,
                                                        transform: `translateY(${idx * 34}px) scale(1)`,
                                                        transition:
                                                            prev.opacity === 0
                                                                ? "opacity 0.15s ease-out"
                                                                : "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.15s ease",
                                                    }));
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedModel(model);
                                                    setIsModelSelectOpen(false);
                                                }}
                                            >
                                                <ModelIcon model={model} />
                                                {model}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="pi-pill"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={cycleEffort}
                                aria-label={`Effort: ${efforts[effortIndex]}`}
                            >
                                <DynamicBarsIcon level={efforts[effortIndex]} />
                                <span className="pi-pill-label">
                  <MorphingText text={efforts[effortIndex]} />
                </span>
                            </button>

                            <button
                                type="button"
                                className="pi-add"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={openFileChooser}
                                disabled={attachments.length >= maxAttachments}
                                aria-label="Attach images"
                            >
                                <PlusIcon />
                            </button>
                        </div>

                        {/* Audio wave visualizer, left of the mic button */}
                        <div className={`pi-wave${isRecording ? " on" : ""}`}>
                            {audioData.map((val, i) => (
                                <div key={i} className="pi-wave-bar" style={{ height: `${Math.max(4, val * 24)}px` }} />
                            ))}
                        </div>

                        {/* Send / mic / stop */}
                        <button
                            type="button"
                            className="pi-send"
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onClick={onActionButtonClick}
                            aria-label={showArrow ? "Send prompt" : showStop ? "Stop recording" : "Use voice input"}
                        >
              <span style={{ position: "relative", display: "block", width: "100%", height: "100%" }}>
                <span className={`pi-send-icon${showArrow ? " on" : ""}`}>
                  <ArrowUpIcon />
                </span>
                <span className={`pi-send-icon neg${showMic ? " on" : ""}`}>
                  <MicIcon />
                </span>
                <span className={`pi-send-icon${showStop ? " on" : ""}`}>
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