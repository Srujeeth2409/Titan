"use client";

import * as React from "react";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

export function MacOsDock({ activeId = "ask" }: { activeId?: string }) {
  const router = useRouter();
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

  // Exactly the 9 apps from user's shared macOS dock image in exact order:
  // 1. Finder (running dot)
  // 2. Calculator
  // 3. Terminal
  // 4. Mail
  // 5. Notes
  // 6. Safari (running dot)
  // 7. Photos
  // 8. Music
  // 9. Calendar (JUL 17)
  const dockApps: DockItemDef[] = [
    {
      id: "finder",
      name: "Finder",
      iconSrc: "/dock/finder.png",
      isRunning: true,
      href: "/app",
    },
    {
      id: "calculator",
      name: "Calculator",
      iconSrc: "/dock/calculator.png",
      onClick: () => {},
    },
    {
      id: "terminal",
      name: "Terminal",
      iconSrc: "/dock/terminal.png",
      href: "/app",
    },
    {
      id: "mail",
      name: "Mail",
      iconSrc: "/dock/mail.png",
      href: "/app/documents",
    },
    {
      id: "notes",
      name: "Notes",
      iconSrc: "/dock/notes.png",
      href: "/app/documents",
    },
    {
      id: "safari",
      name: "Safari",
      iconSrc: "/dock/safari.png",
      isRunning: true,
      onClick: () => window.open("https://apple.com", "_blank"),
    },
    {
      id: "photos",
      name: "Photos",
      iconSrc: "/dock/photos.png",
      onClick: () => {},
    },
    {
      id: "music",
      name: "Music",
      iconSrc: "/dock/music.png",
      onClick: () => {},
    },
    {
      id: "calendar",
      name: "Calendar",
      iconSrc: "/dock/calendar.png",
      onClick: () => {},
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
          20% { transform: translateY(-24px); }
          40% { transform: translateY(0); }
          60% { transform: translateY(-12px); }
          80% { transform: translateY(0); }
          90% { transform: translateY(-4px); }
        }
        .mac-bouncing {
          animation: macBounce 0.7s cubic-bezier(0.28, 0.84, 0.42, 1);
        }
        @keyframes modalPop {
          0% { opacity: 0; transform: scale(0.95) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `,
        }}
      />

      {/* ── macOS Floating Dock (Matching user's shared image exactly) ── */}
      <div
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-end justify-center select-none"
        onMouseMove={(e) => setMouseX(e.clientX)}
        onMouseLeave={() => setMouseX(null)}
        data-grid-avoid
      >
        {/* Dock Shelf: Frosted container with diffuse drop shadow */}
        <div
          style={{
            display: "flex",
            height: "74px",
            alignItems: "flex-end",
            gap: "6px",
            borderRadius: "22px",
            border: "1px solid rgba(255, 255, 255, 0.22)",
            background: "rgba(68, 68, 72, 0.82)",
            padding: "0 12px 8px 12px",
            boxShadow:
              "0 22px 50px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
            backdropFilter: "blur(50px) saturate(1.9)",
            WebkitBackdropFilter: "blur(50px) saturate(1.9)",
            transition: "all 200ms ease",
          }}
        >
          {dockApps.map((app) => (
            <DockItem
              key={app.id}
              app={app}
              mouseX={mouseX}
              isBouncing={bouncingId === app.id}
              isActive={
                app.id === "finder" ||
                (app.id === "notes" && activeId === "documents") ||
                (app.id === "terminal" && activeId === "ask")
              }
              onClick={() => handleItemClick(app)}
            />
          ))}

          {/* ── Vertical macOS Divider Line ── */}
          <div
            style={{
              width: "1px",
              height: "48px",
              background: "rgba(255, 255, 255, 0.22)",
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
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
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
              background: "rgba(255, 255, 255, 0.94)",
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

              {/* Title & Count */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={trashCount > 0 ? "/dock/trash-full.png" : "/dock/trash-empty.png"}
                  alt="Trash"
                  width={20}
                  height={20}
                  style={{ width: "20px", height: "20px" }}
                />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                  Trash
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#64748b",
                    background: "rgba(0, 0, 0, 0.06)",
                    padding: "2px 8px",
                    borderRadius: "10px",
                  }}
                >
                  {trashCount} {trashCount === 1 ? "item" : "items"}
                </span>
              </div>

              {/* Empty Trash Button */}
              {trashCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setEmptyConfirmOpen(true)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "7px",
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

            {/* Empty Confirmation Banner */}
            {emptyConfirmOpen && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 18px",
                  background: "#fef2f2",
                  borderBottom: "1px solid #fee2e2",
                  fontSize: "12px",
                  color: "#991b1b",
                }}
              >
                <span>Are you sure you want to permanently erase all items in Trash?</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setEmptyConfirmOpen(false)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
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
                    onClick={async () => {
                      await emptyAllTrash();
                      setEmptyConfirmOpen(false);
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      background: "#dc2626",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      color: "#ffffff",
                    }}
                  >
                    Empty Trash
                  </button>
                </div>
              </div>
            )}

            {/* Window Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: trashCount === 0 ? "48px 24px" : "12px 18px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {trashCount === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    color: "#94a3b8",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/dock/trash-empty.png"
                    alt="Empty Trash"
                    width={72}
                    height={72}
                    style={{ opacity: 0.7 }}
                  />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: "#475569" }}>
                      Trash is Empty
                    </div>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                      When you delete documents from the workstation, they will appear here.
                    </div>
                  </div>
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
                      borderRadius: "10px",
                      background: "#ffffff",
                      border: "1px solid rgba(0, 0, 0, 0.06)",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
                      gap: "14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          background: "#f1f5f9",
                          border: "1px solid #e2e8f0",
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
   Individual Dock Item with macOS Magnification & Running Dot
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

  let scale = 1;
  if (mouseX !== null && ref.current) {
    const rect = ref.current.getBoundingClientRect();
    const iconCenter = rect.left + rect.width / 2;
    const distance = Math.abs(mouseX - iconCenter);
    const maxDistance = 140;

    if (distance < maxDistance) {
      const normal = 1 - distance / maxDistance;
      scale = 1 + 0.42 * Math.sin((normal * Math.PI) / 2);
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
            ? "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)"
            : "none",
      }}
    >
      {/* Tooltip */}
      <div
        className={cn(
          "pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium text-white shadow-xl transition-all duration-180 z-50",
          isHovered
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-1.5 opacity-0 scale-95"
        )}
        style={{
          background: "rgba(24, 24, 28, 0.88)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
        }}
      >
        {app.name}
      </div>

      {/* App Icon Button — Using real macOS system-extracted PNG icons */}
      <button
        type="button"
        onClick={onClick}
        className="relative flex items-center justify-center outline-none cursor-pointer transition-transform active:scale-95"
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "12px",
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
          width={52}
          height={52}
          draggable={false}
          style={{
            width: "52px",
            height: "52px",
            objectFit: "contain",
            pointerEvents: "none",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
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

      {/* Running Indicator Dot (Matching Finder & Safari in screenshot) */}
      <span
        style={{
          width: "4px",
          height: "4px",
          borderRadius: "50%",
          marginTop: "3px",
          background: "#ffffff",
          opacity: app.isRunning ? 0.95 : 0,
          boxShadow: app.isRunning ? "0 0 6px rgba(255,255,255,0.9)" : "none",
          transition: "all 200ms ease",
        }}
      />
    </div>
  );
}

export default MacOsDock;
