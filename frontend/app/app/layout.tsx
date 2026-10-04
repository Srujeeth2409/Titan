"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

        {/* Right: Status + Keyboard shortcut hint */}
        <div className="workspace-header-right">
          <div className="workspace-status-pill">
            <span className="workspace-status-dot" />
            <span>Online</span>
          </div>

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
