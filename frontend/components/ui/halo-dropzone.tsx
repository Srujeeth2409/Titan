"use client";

/**
 * HaloDropzone — Animated file dropzone with glowing rim, file-type detection,
 * and upload progress rows. Simplified integration from the full component spec.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { Check, File, FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── File helpers ─── */

export function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export type FilePlaceholderKind =
  | "generic" | "pdf" | "doc" | "sheet" | "txt" | "json" | "md" | "ppt";

export function inferPlaceholderKind(file: File): FilePlaceholderKind {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const t = file.type;
  if (t === "application/pdf" || ext === "pdf") return "pdf";
  if (t.includes("wordprocessingml") || t === "application/msword" || ext === "doc" || ext === "docx") return "doc";
  if (t.includes("spreadsheet") || t.includes("excel") || t === "text/csv" || ["xls","xlsx","csv","ods"].includes(ext)) return "sheet";
  if (t === "text/plain" || ext === "txt" || ext === "log") return "txt";
  if (t.includes("json") || ext === "json") return "json";
  if (ext === "md" || ext === "mdx" || t.includes("markdown")) return "md";
  if (t.includes("presentation") || t.includes("powerpoint") || ext === "ppt" || ext === "pptx") return "ppt";
  return "generic";
}

export function formatFileBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

const KIND_COLORS: Record<FilePlaceholderKind, string> = {
  generic: "#6b7280",
  pdf: "#ef4444",
  doc: "#3b82f6",
  sheet: "#22c55e",
  txt: "#f97316",
  json: "#eab308",
  md: "#64748b",
  ppt: "#ea580c",
};

const KIND_LABELS: Record<FilePlaceholderKind, string> = {
  generic: "FILE",
  pdf: "PDF",
  doc: "DOC",
  sheet: "XLS",
  txt: "TXT",
  json: "JSON",
  md: "MD",
  ppt: "PPT",
};

/* ─── DropzoneFileTypeGlyph ─── */

export function DropzoneFileTypeGlyph({ file }: { file: File }) {
  const kind = inferPlaceholderKind(file);
  const color = KIND_COLORS[kind];

  return (
    <div
      style={{
        width: "34px",
        height: "34px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <FileText
        style={{ width: "28px", height: "28px", color }}
        strokeWidth={1.5}
      />
      <span
        style={{
          position: "absolute",
          bottom: "-2px",
          right: "-4px",
          fontSize: "7px",
          fontWeight: 800,
          color: "#fff",
          background: color,
          padding: "1px 3px",
          borderRadius: "3px",
          letterSpacing: "0.04em",
          lineHeight: 1,
          textTransform: "uppercase",
        }}
      >
        {KIND_LABELS[kind]}
      </span>
    </div>
  );
}

/* ─── HaloDropzone ─── */

export interface HaloDropzoneProps {
  className?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  translucent?: boolean;
  onFiles?: (files: File[]) => void;
  successResetMs?: number;
  emptyLabel?: string;
  successLabel?: string;
  idleIcon?: ReactNode;
  formatHint?: string | null;
  showSuccessThumbnails?: boolean;
}

export function HaloDropzone({
  className,
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  successResetMs = 2400,
  emptyLabel = "Drop files here or browse",
  successLabel = "Upload complete",
  idleIcon,
  formatHint = "PNG, JPG, PDF up to 10MB",
  showSuccessThumbnails = true,
}: HaloDropzoneProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const successTimerRef = useRef<number | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    };
  }, []);

  const emitFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list || disabled) return;
      const files = Array.from(list);
      if (files.length === 0) return;
      onFiles?.(files);
      setUploadedFiles(files);
      setShowSuccess(true);
      if (successResetMs > 0) {
        if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
        successTimerRef.current = window.setTimeout(() => {
          setShowSuccess(false);
          setUploadedFiles([]);
          successTimerRef.current = null;
        }, successResetMs);
      }
    },
    [disabled, onFiles, successResetMs],
  );

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    emitFiles(e.target.files);
    e.target.value = "";
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    if (disabled) return;
    emitFiles(e.dataTransfer.files);
  };

  const rimActive = isHovered || isDragging || showSuccess;

  return (
    <div className={cn("relative w-full max-w-2xl", className)}>
      <input
        accept={accept}
        className="sr-only"
        disabled={disabled}
        id={inputId}
        multiple={multiple}
        onChange={handleInputChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <label
        htmlFor={inputId}
        className={cn(
          "relative block cursor-pointer rounded-2xl outline-none",
          "focus-visible:ring-2 focus-visible:ring-indigo-400/40 focus-visible:ring-offset-2",
          disabled && "pointer-events-none cursor-not-allowed opacity-60",
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes halo-rim-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes halo-float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-4px); }
          }
        `}} />

        <div className="relative rounded-2xl p-px">
          {/* Animated rim glow */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden"
            style={{
              opacity: rimActive ? 1 : 0.3,
              transition: "opacity 400ms ease",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "-50%",
                animation: "halo-rim-spin 6s linear infinite",
                background: isDragging
                  ? "conic-gradient(from 0deg, #6366f1, #a78bfa, #818cf8, #6366f1)"
                  : showSuccess
                  ? "conic-gradient(from 0deg, #10b981, #34d399, #6ee7b7, #10b981)"
                  : "conic-gradient(from 0deg, rgba(99,102,241,0.4), rgba(168,85,247,0.3), rgba(59,130,246,0.4), rgba(99,102,241,0.4))",
              }}
            />
          </div>

          {/* Inner surface — Clean White Glassmorphism matching light theme */}
          <div
            className="relative z-10 flex flex-col items-center justify-center gap-3 rounded-[15px] px-6 min-h-44 py-8"
            style={{
              background: isDragging
                ? "rgba(238, 242, 255, 0.85)"
                : "rgba(255, 255, 255, 0.85)",
              border: isDragging
                ? "1.5px dashed #6366f1"
                : "1.5px dashed #cbd5e1",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              transition: "all 300ms ease",
            }}
          >
            {showSuccess ? (
              <div className="flex w-full max-w-full flex-col items-center gap-4 text-center">
                <div className="flex items-center justify-center gap-2" style={{ color: "#059669" }}>
                  <span
                    style={{
                      display: "flex",
                      width: "36px",
                      height: "36px",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      background: "rgba(16, 185, 129, 0.12)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    <Check size={18} strokeWidth={2.25} />
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "14px", color: "#065f46" }}>
                    {successLabel}
                  </span>
                </div>

                {showSuccessThumbnails && uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-4">
                    {uploadedFiles.map((file) => (
                      <div
                        key={fileKey(file)}
                        className="flex flex-col items-center gap-1.5"
                        style={{ width: "76px" }}
                      >
                        <div
                          style={{
                            width: "64px",
                            height: "64px",
                            borderRadius: "12px",
                            background: "rgba(241, 245, 249, 0.8)",
                            border: "1px solid rgba(226, 232, 240, 0.9)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          {file.type.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt=""
                              src={URL.createObjectURL(file)}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <DropzoneFileTypeGlyph file={file} />
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#475569",
                            textAlign: "center",
                            lineHeight: 1.2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            maxWidth: "76px",
                          }}
                        >
                          {file.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[8.5rem] w-full max-w-full flex-col items-center justify-center gap-3 text-center">
                <span
                  style={{
                    display: "flex",
                    width: "48px",
                    height: "48px",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    background: "rgba(79, 70, 229, 0.08)",
                    border: "1px solid rgba(79, 70, 229, 0.16)",
                    color: "#4f46e5",
                    animation: disabled ? "none" : "halo-float 4.5s ease-in-out infinite",
                  }}
                >
                  {idleIcon ?? <Upload size={20} strokeWidth={2} />}
                </span>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", maxWidth: "340px" }}>
                  {emptyLabel}
                </span>
                {formatHint && (
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    {formatHint}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </label>
    </div>
  );
}

/* ─── Upload file row ─── */

export interface DropzoneUploadFileRowProps {
  file: File;
  progress: number;
  complete?: boolean;
  onRemove?: () => void;
  className?: string;
}

export function DropzoneUploadFileRow({
  file,
  progress,
  complete = false,
  onRemove,
  className,
}: DropzoneUploadFileRowProps) {
  const pct = Math.min(100, Math.max(0, progress));
  const widthPct = complete ? 100 : pct;

  return (
    <div
      className={cn("rounded-xl p-3", className)}
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <DropzoneFileTypeGlyph file={file} />
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
          <div className="flex items-start justify-between gap-2">
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {file.name}
              </p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
                {formatFileBytes(file.size)}
              </p>
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${file.name}`}
                style={{
                  padding: "4px",
                  borderRadius: "6px",
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.35)",
                  cursor: "pointer",
                  transition: "color 150ms ease",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
              >
                <X size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div
          style={{
            flex: 1,
            height: "6px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: "999px",
              width: `${widthPct}%`,
              background: complete
                ? "rgba(52, 211, 153, 0.9)"
                : "linear-gradient(90deg, #6366f1, #818cf8, #a78bfa)",
              transition: "width 300ms ease-out",
            }}
          />
        </div>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(complete ? 100 : pct)}%
        </span>
      </div>
    </div>
  );
}

/* ─── Upload file list ─── */

export interface QueuedFile {
  id: string;
  file: File;
  progress: number;
  done: boolean;
}

interface DropzoneUploadFileListProps {
  items: QueuedFile[];
  onRemove: (id: string) => void;
  className?: string;
}

export function DropzoneUploadFileList({
  items,
  onRemove,
  className,
}: DropzoneUploadFileListProps) {
  if (items.length === 0) return null;

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((item) => (
        <li key={item.id}>
          <DropzoneUploadFileRow
            complete={item.done}
            file={item.file}
            onRemove={() => onRemove(item.id)}
            progress={item.done ? 100 : item.progress}
          />
        </li>
      ))}
    </ul>
  );
}

export default HaloDropzone;
