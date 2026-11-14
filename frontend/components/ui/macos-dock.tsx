"use client";

import * as React from "react";
import { useRef, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTrash } from "@/lib/trash-store";

export interface DockItemDef {
  id: string;
  name: string;
  iconSrc: string;
  isRunning?: boolean;
  href?: string;
  badge?: number;
  onClick?: () => void;
}

export function MacOsDock({ activeId }: { activeId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [bouncingId, setBouncingId] = useState<string | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);

  const { trash, trashCount, restoreFromTrash, permanentDeleteFromTrash, emptyAllTrash } = useTrash();

  // Trigger bounce animation on trash icon when a new item is added to trash
  useEffect(() => {
    const handleTrashChanged = () => {
      setBouncingId("trash");
      setTimeout(() => setBouncingId(null), 700);
    };
    window.addEventListener("titan:trash-changed", handleTrashChanged);
    return () => window.removeEventListener("titan:trash-changed", handleTrashChanged);
  }, []);

  const handleItemClick = (item: DockItemDef) => {
    setBouncingId(item.id);
    setTimeout(() => setBouncingId(null), 700);

    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  // Authentic macOS Dock Apps:
  // 1. Titan AI -> Core Intelligence / RAG Workstation (/app)
  // 2. Documents (Finder) -> Enterprise Document Corpus (/app/documents)
  // 3. Mail -> Corporate Realtime Mail (/app/mail)
  // 4. Notes -> Quick Notes Drawer
  // 5. Calculator -> Calculator Tool
  // [Chat, Calendar, and Meetings removed per user specification]
  const dockApps: DockItemDef[] = [
    {
      id: "titan-ai",
      name: "Titan AI",
      iconSrc: "/dock/titan-ai.svg",
      href: "/app",
    },
    {
      id: "finder",
      name: "Documents",
      iconSrc: "/dock/finder.png",
      href: "/app/documents",
    },
    {
      id: "mail",
      name: "Mail",
      iconSrc: "/dock/mail.png",
      href: "/app/mail",
    },
    {
      id: "notes",
      name: "Notes",
      iconSrc: "/dock/notes.png",
      onClick: () => window.dispatchEvent(new CustomEvent("titan:open-notes")),
    },
    {
      id: "calculator",
      name: "Calculator",
      iconSrc: "/dock/calculator.png",
      onClick: () => window.dispatchEvent(new CustomEvent("titan:open-calculator")),
    },
  ];

  const trashItem: DockItemDef = {
    id: "trash",
    name: trashCount > 0 ? `Trash (${trashCount})` : "Trash",
    iconSrc: trashCount > 0 ? "/dock/trash-full.png" : "/dock/trash-empty.png",
    badge: trashCount > 0 ? trashCount : undefined,
    onClick: () => setIsTrashOpen(true),
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes macBounce {
          0%, 100% { transform: translateY(0); }
          22% { transform: translateY(-28px); }
          40% { transform: translateY(0); }
          60% { transform: translateY(-14px); }
          78% { transform: translateY(0); }
          90% { transform: translateY(-4px); }
        }
        .mac-bouncing {
          animation: macBounce 0.72s cubic-bezier(0.25, 1, 0.5, 1);
        }
        @keyframes modalPop {
          0% { opacity: 0; transform: scale(0.96) translateY(12px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `,
        }}
      />

      {/* ── macOS Floating Dock Container ── */}
      <div
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-end justify-center select-none"
        onMouseMove={(e) => setMouseX(e.clientX)}
        onMouseLeave={() => setMouseX(null)}
        data-grid-avoid
      >
        {/* Dock Shelf: Authentic Apple Frosted Glass with Specular Light Rim */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            height: "70px",
            gap: "8px",
            borderRadius: "24px",
            border: "0.5px solid rgba(255, 255, 255, 0.45)",
            background: "rgba(255, 255, 255, 0.32)",
            padding: "0 10px 6px 10px",
            boxShadow:
              "0 24px 50px -10px rgba(15, 23, 42, 0.35), 0 10px 20px -6px rgba(15, 23, 42, 0.2), inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.85), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.08)",
            backdropFilter: "blur(36px) saturate(210%) contrast(100%)",
            WebkitBackdropFilter: "blur(36px) saturate(210%) contrast(100%)",
            transition: "padding 180ms ease",
          }}
        >
          {dockApps.map((app) => {
            const isCurrentApp =
              app.href === "/app"
                ? pathname === "/app"
                : Boolean(app.href && pathname?.startsWith(app.href));

            return (
              <DockItem
                key={app.id}
                app={{ ...app, isRunning: isCurrentApp }}
                mouseX={mouseX}
                isBouncing={bouncingId === app.id}
                isActive={isCurrentApp}
                onClick={() => handleItemClick(app)}
              />
            );
          })}

          {/* ── Apple Vertical Etched Glass Divider ── */}
          <div
            style={{
              width: "1px",
              height: "44px",
              background:
                "linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0.1) 100%)",
              boxShadow: "0.5px 0 0 rgba(0, 0, 0, 0.1)",
              margin: "0 3px 6px 3px",
              flexShrink: 0,
            }}
          />

          {/* ── Trash Icon ── */}
          <DockItem
            key={trashItem.id}
            app={trashItem}
            mouseX={mouseX}
            isBouncing={bouncingId === trashItem.id}
            isActive={isTrashOpen}
            onClick={() => handleItemClick(trashItem)}
          />
        </div>
      </div>

      {/* ── macOS Finder Trash Window / Modal ── */}
      {isTrashOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.35)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
          onClick={() => setIsTrashOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "680px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(40px) saturate(1.8)",
              WebkitBackdropFilter: "blur(40px) saturate(1.8)",
              borderRadius: "16px",
              border: "1px solid rgba(0, 0, 0, 0.12)",
              boxShadow: "0 28px 60px rgba(0, 0, 0, 0.25), 0 6px 18px rgba(0, 0, 0, 0.1)",
              animation: "modalPop 220ms cubic-bezier(0.16, 1, 0.3, 1)",
              overflow: "hidden",
            }}
          >
            {/* macOS Window Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
                background: "rgba(246, 246, 246, 0.8)",
              }}
            >
              {/* Traffic Light Window Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsTrashOpen(false)}
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#ff5f56",
                    border: "1px solid #e0443e",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  title="Close"
                />
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#ffbd2e",
                    border: "1px solid #dea123",
                  }}
                />
                <span
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "#27c93f",
                    border: "1px solid #1aab29",
                  }}
                />
              </div>

              {/* Title */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                <img src="/dock/trash-empty.png" alt="Trash" width={18} height={18} />
                <span>Trash — {trashCount} {trashCount === 1 ? "item" : "items"}</span>
              </div>

              {/* Empty Trash Action Button */}
              {trashCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setEmptyConfirmOpen(true)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#dc2626",
                    background: "rgba(220, 38, 38, 0.08)",
                    border: "1px solid rgba(220, 38, 38, 0.2)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  Empty Trash
                </button>
              ) : (
                <div style={{ width: "70px" }} />
              )}
            </div>

            {/* Confirmation Dialog for Empty Trash */}
            {emptyConfirmOpen && (
              <div
                style={{
                  padding: "12px 18px",
                  background: "rgba(254, 242, 242, 0.95)",
                  borderBottom: "1px solid #fecaca",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "#991b1b",
                }}
              >
                <span>Permanently delete all {trashCount} items? This action cannot be undone.</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setEmptyConfirmOpen(false)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "5px",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      color: "#475569",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      emptyAllTrash();
                      setEmptyConfirmOpen(false);
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "5px",
                      background: "#dc2626",
                      border: "1px solid #b91c1c",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      color: "#ffffff",
                    }}
                  >
                    Empty
                  </button>
                </div>
              </div>
            )}

            {/* Trash Items List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                minHeight: "220px",
              }}
            >
              {trash.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: 1,
                    padding: "48px 0",
                    color: "#94a3b8",
                  }}
                >
                  <img src="/dock/trash-empty.png" alt="Empty Trash" width={64} height={64} style={{ opacity: 0.5 }} />
                  <p style={{ marginTop: "12px", fontSize: "14px", fontWeight: 500 }}>Trash is Empty</p>
                  <p style={{ fontSize: "12px", color: "#cbd5e1" }}>Deleted documents will appear here</p>
                </div>
              ) : (
                trash.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "#ffffff",
                      border: "1px solid rgba(0, 0, 0, 0.06)",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "6px",
                          background: "#f1f5f9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#64748b",
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#0f172a",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.filename}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#64748b",
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                            marginTop: "2px",
                          }}
                        >
                          <span>Collection: {item.collection}</span>
                          <span>•</span>
                          <span>{new Date(item.deleted_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => restoreFromTrash(item.id)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#4f46e5",
                          background: "rgba(79, 70, 229, 0.08)",
                          border: "1px solid rgba(79, 70, 229, 0.2)",
                          cursor: "pointer",
                        }}
                        title="Restore back to Active Corpus"
                      >
                        Put Back
                      </button>

                      <button
                        type="button"
                        onClick={() => permanentDeleteFromTrash(item.id)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#dc2626",
                          background: "transparent",
                          border: "1px solid rgba(220, 38, 38, 0.2)",
                          cursor: "pointer",
                        }}
                        title="Permanently Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Window Footer */}
            <div
              style={{
                padding: "10px 18px",
                borderTop: "1px solid rgba(0, 0, 0, 0.06)",
                background: "rgba(246, 246, 246, 0.6)",
                fontSize: "11px",
                color: "#64748b",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Items in Trash are isolated from RAG search and generation.</span>
              <button
                type="button"
                onClick={() => setIsTrashOpen(false)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "5px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "#334155",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Individual Dock Item with Apple Continuous Cosine Wave Magnification
   ───────────────────────────────────────────────────────────────────────────── */

function DockItem({
  app,
  mouseX,
  isBouncing,
  isActive,
  onClick,
}: {
  app: DockItemDef;
  mouseX: number | null;
  isBouncing: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Authentic Apple Continuous Cosine Wave Magnification
  // Target icon scales up to 1.48x; neighboring icons scale smoothly along the cosine bell curve
  let scale = 1;
  if (mouseX !== null && ref.current) {
    const rect = ref.current.getBoundingClientRect();
    const iconCenter = rect.left + rect.width / 2;
    const distance = Math.abs(mouseX - iconCenter);
    const maxDistance = 145; // Influence radius spanning ~2.5 icons

    if (distance < maxDistance) {
      const factor = (Math.cos((distance / maxDistance) * Math.PI) + 1) / 2;
      scale = 1 + 0.48 * factor;
    }
  }

  return (
    <div
      ref={ref}
      className={cn(
        "group relative flex flex-col items-center justify-end",
        isBouncing && "mac-bouncing"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "bottom center",
        transition:
          mouseX === null
            ? "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)"
            : "none",
        paddingBottom: "2px",
      }}
    >
      {/* Apple-Style Dark Glass Tooltip with Pointer Caret */}
      <div
        className={cn(
          "pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[7px] px-2.5 py-1 text-[11.5px] font-medium text-white shadow-2xl transition-all duration-150 z-50 flex items-center justify-center",
          isHovered
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-1 opacity-0 scale-95"
        )}
        style={{
          background: "rgba(28, 28, 32, 0.86)",
          backdropFilter: "blur(24px) saturate(1.8)",
          WebkitBackdropFilter: "blur(24px) saturate(1.8)",
          border: "0.5px solid rgba(255, 255, 255, 0.24)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.2)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif",
          letterSpacing: "-0.01em",
        }}
      >
        {app.name}
        {/* Tooltip downward caret arrow */}
        <div
          style={{
            position: "absolute",
            bottom: "-4px",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            borderTop: "4px solid rgba(28, 28, 32, 0.86)",
          }}
        />
      </div>

      {/* App Icon Button with Subtle Apple Soft Drop Shadow */}
      <button
        type="button"
        onClick={onClick}
        className="relative flex items-center justify-center outline-none cursor-pointer transition-transform active:scale-95"
        style={{
          width: "50px",
          height: "50px",
          padding: 0,
          background: "transparent",
          border: "none",
        }}
        aria-label={app.name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={app.iconSrc}
          alt={app.name}
          width={50}
          height={50}
          draggable={false}
          style={{
            width: "50px",
            height: "50px",
            objectFit: "contain",
            pointerEvents: "none",
            filter: "drop-shadow(0 3px 6px rgba(0, 0, 0, 0.18))",
          }}
        />

        {/* Badge if item has notifications (e.g. Trash item count) */}
        {app.badge !== undefined && app.badge > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              minWidth: "18px",
              height: "18px",
              padding: "0 5px",
              borderRadius: "9px",
              background: "#ef4444",
              border: "1.5px solid #ffffff",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 5px rgba(0,0,0,0.25)",
            }}
          >
            {app.badge}
          </span>
        )}
      </button>

      {/* Running Indicator Dot (Centered directly beneath active apps) */}
      <span
        style={{
          width: "4px",
          height: "4px",
          borderRadius: "50%",
          marginTop: "3px",
          background: "rgba(15, 23, 42, 0.85)",
          opacity: app.isRunning ? 1 : 0,
          boxShadow: app.isRunning ? "0 0 3px rgba(15, 23, 42, 0.5)" : "none",
          transition: "opacity 180ms ease, transform 180ms ease",
        }}
      />
    </div>
  );
}

export default MacOsDock;
