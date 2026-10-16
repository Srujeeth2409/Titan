"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { href: "/app", label: "Ask", icon: "chat" },
  { href: "/app/documents", label: "Documents", icon: "docs" },
];

function NavIcon({ type, size = 16 }: { type: string; size?: number }) {
  if (type === "chat") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  if (type === "docs") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    );
  }
  return null;
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { user, loading, logout } = useAuth();

  useEffect(() => setMounted(true), []);

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  // Show nothing while loading or redirecting
  if (loading || !user) {
    return (
      <div style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "rgba(255,255,255,0.4)",
        fontSize: "13px",
        fontFamily: "system-ui, sans-serif",
      }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="workspace-shell">
      {/* ── TOP HEADER BAR ── */}
      <header className="workspace-header">
        {/* Left: Brand + Nav */}
        <div className="workspace-header-left">
          <Link href="/" className="workspace-brand">
            {/* Diamond logo */}
            <svg viewBox="0 0 25 25" fill="none" className="workspace-brand-logo">
              <clipPath id="brand-ws"><circle cx="12.5" cy="12.5" r="12.5"/></clipPath>
              <g clipPath="url(#brand-ws)">
                <rect width="25" height="25" fill="#ededed"/>
                <path d="M12.5 0 L25 12.5 L12.5 25 Z" fill="#050606"/>
                <path d="M0 12.5 L12.5 0 L12.5 12.5 Z" fill="#737778"/>
                <path d="M12.5 12.5 L25 12.5 L12.5 25 Z" fill="#fafafa" opacity="0.85"/>
                <path d="M0 12.5 L12.5 12.5 L6.25 25 Z" fill="#0a0b0b"/>
                <polygon points="12.5,4 18,12.5 12.5,21 7,12.5" fill="#ffffff"/>
                <polygon points="12.5,7 15.5,12.5 12.5,18 9.5,12.5" fill="#0a0b0b"/>
              </g>
            </svg>
            <span className="workspace-brand-text">Titan</span>
          </Link>

          <div className="workspace-nav-divider" />

          <nav className="workspace-nav">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/app" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`workspace-nav-item ${isActive ? "active" : ""}`}
                >
                  <NavIcon type={item.icon} size={15} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Status + User + Keyboard shortcut hint */}
        <div className="workspace-header-right">
          <div className="workspace-status-pill">
            <span className="workspace-status-dot" />
            <span>Online</span>
          </div>

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.7)",
                  background: "rgba(255,255,255,0.06)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  maxWidth: "180px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={user.email}
              >
                {user.email}
              </span>
              <button
                onClick={async () => { await logout(); router.push("/login"); }}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.8)",
                  fontSize: "11px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)")}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}
              >
                Sign Out
              </button>
            </div>
          ) : !loading ? (
            <Link
              href="/login"
              style={{
                fontSize: "12px",
                background: "#ffffff",
                color: "#000000",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "6px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Sign In
            </Link>
          ) : null}

          {mounted && (
            <kbd className="workspace-kbd">
              <span>⌘</span>K
            </kbd>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="workspace-main">
        {children}
      </main>
    </div>
  );
}
