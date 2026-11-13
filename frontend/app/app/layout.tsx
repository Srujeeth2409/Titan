"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { GridPulse } from "@/components/ui/grid-pulse";
import { GradientBackground } from "@/components/ui/noisy-gradient-backgrounds";
import { MacOsDock } from "@/components/ui/macos-dock";
import { WorkstationNavbar } from "@/components/workstation-navbar";
import { GlobalSearchModal } from "@/components/global-search-modal";
import { CalculatorModal } from "@/components/calculator-modal";
import { QuickNotesDrawer } from "@/components/quick-notes-drawer";

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
      {/* ── Global Background: Noisy Gradient Background with Interactive GridPulse ── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          overflow: "hidden",
        }}
      >
        {/* Noisy Gradient Background Layer with Sunset Glow / Radial Sunset palette (light tint) */}
        <GradientBackground
          gradientOrigin="bottom-middle"
          colors={[
            { color: "rgba(245, 87, 2, 0.18)", stop: "10.5%" },
            { color: "rgba(245, 120, 2, 0.16)", stop: "16%" },
            { color: "rgba(245, 140, 2, 0.14)", stop: "17.5%" },
            { color: "rgba(245, 170, 100, 0.18)", stop: "25%" },
            { color: "rgba(238, 174, 202, 0.28)", stop: "40%" },
            { color: "rgba(202, 179, 214, 0.35)", stop: "65%" },
            { color: "rgba(230, 240, 255, 0.85)", stop: "100%" },
          ]}
          noiseIntensity={0.65}
          noisePatternSize={90}
          noisePatternRefreshInterval={2}
          noisePatternAlpha={30}
          className="opacity-95"
        />

        {/* Interactive GridPulse on top of the Noisy Gradient */}
        <GridPulse
          cell={24}
          reach={2.6}
          ambient={2}
          avoid="[data-grid-avoid]"
          className="opacity-75"
          style={{
            "--grid-pulse-line": "rgba(99, 102, 241, 0.08)",
          } as React.CSSProperties}
        />

        {/* Subtle Ambient Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 50% 0%, transparent 60%, rgba(99, 102, 241, 0.03) 100%)",
            pointerEvents: "none",
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

      {/* ── Global Overlays ── */}
      <GlobalSearchModal />
      <CalculatorModal />
      <QuickNotesDrawer />
    </div>
  );
}
