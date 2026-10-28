"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { GridPulse } from "@/components/ui/grid-pulse";
import { MacOsDock } from "@/components/ui/macos-dock";
import { WorkstationNavbar } from "@/components/workstation-navbar";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          width: "100vw",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#0f172a",
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#4f46e5",
              boxShadow: "0 0 12px rgba(79,70,229,0.4)",
              animation: "pulse 1.5s ease infinite",
            }}
          />
          <span style={{ fontWeight: 500, color: "#64748b" }}>Starting Titan Workstation…</span>
        </div>
      </div>
    );
  }

  // Determine active dock item from path
  const activeId = pathname.startsWith("/app/documents") ? "documents" : "ask";

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        background: "#ffffff",
        color: "#0f172a",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      }}
    >
      {/* ── Global Background: GridPulse in original cell size (24px) ── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          overflow: "hidden",
        }}
      >
        <GridPulse
          cell={24}
          reach={2.6}
          ambient={2}
          avoid="[data-grid-avoid]"
          className="opacity-70"
          style={{
            "--grid-pulse-line": "rgba(0, 0, 0, 0.05)",
          } as React.CSSProperties}
        />

        {/* Ambient atmospheric subtle light gradients */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            left: "20%",
            width: "50vw",
            height: "40vh",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.035) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "5%",
            right: "15%",
            width: "40vw",
            height: "35vh",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(56, 189, 248, 0.03) 0%, transparent 70%)",
            filter: "blur(70px)",
          }}
        />
      </div>

      {/* ── Glass Navbar (White frosted glass) ── */}
      <WorkstationNavbar />

      {/* ── Main Content Area ── */}
      <main
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          paddingTop: "68px",
          paddingBottom: "115px",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </main>

      {/* ── macOS Dock with Trash Bin ── */}
      <MacOsDock activeId={activeId} />
    </div>
  );
}
