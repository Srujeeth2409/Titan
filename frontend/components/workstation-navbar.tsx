"use client";

import * as React from "react";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

export function WorkstationNavbar() {
  const pathname = usePathname();
  const [timeString, setTimeString] = useState<string>("");
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const dateStr = now.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      setTimeString(`${dateStr}  ${timeStr}`);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // ONLY relevant modules from Titan RAG documentation
  const navItems: NavItem[] = [
    {
      id: "ask",
      label: "Ask",
      href: "/app",
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      id: "documents",
      label: "Documents",
      href: "/app/documents",
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
  ];

  function isActive(href: string) {
    if (href === "/app") return pathname === "/app";
    return pathname?.startsWith(href);
  }

  return (
    <header
      className="workstation-navbar"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: "68px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 36px",
        backdropFilter: "blur(24px) saturate(1.8)",
        WebkitBackdropFilter: "blur(24px) saturate(1.8)",
        background: isScrolled
          ? "rgba(255, 255, 255, 0.90)"
          : "rgba(255, 255, 255, 0.78)",
        borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
        transition: "background 300ms ease, box-shadow 300ms ease",
        boxShadow: isScrolled
          ? "0 4px 24px rgba(0, 0, 0, 0.06)"
          : "0 1px 12px rgba(0, 0, 0, 0.03)",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}
    >
      {/* Left: Brand / Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        <Link
          href="/app"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            textDecoration: "none",
            color: "#0f172a",
          }}
        >
          {/* Titan Logo Mark */}
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #4f46e5, #6366f1, #3b82f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 10px rgba(79, 70, 229, 0.3)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              width="20"
              height="20"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              <line x1="12" y1="22" x2="12" y2="15.5" />
              <polyline points="22 8.5 12 15.5 2 8.5" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "17px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#0f172a",
                lineHeight: 1.1,
              }}
            >
              Titan
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#64748b",
              }}
            >
              RAG Workstation
            </span>
          </div>
        </Link>
      </div>

      {/* Center: Relevant Navigation Modules */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px",
          borderRadius: "12px",
          background: "rgba(0, 0, 0, 0.04)",
          border: "1px solid rgba(0, 0, 0, 0.06)",
        }}
      >
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 18px",
                borderRadius: "9px",
                fontSize: "14px",
                fontWeight: active ? 600 : 500,
                color: active ? "#4f46e5" : "#64748b",
                background: active
                  ? "#ffffff"
                  : "transparent",
                textDecoration: "none",
                transition: "all 180ms ease",
                whiteSpace: "nowrap",
                boxShadow: active
                  ? "0 2px 8px rgba(0, 0, 0, 0.06)"
                  : "none",
                border: active
                  ? "1px solid rgba(0, 0, 0, 0.06)"
                  : "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "#0f172a";
                  e.currentTarget.style.background = "rgba(0, 0, 0, 0.03)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = "#64748b";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: Clock + Traditional Profile Icon Dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        {/* Monospace Clock */}
        <div
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#64748b",
            fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
            background: "rgba(0, 0, 0, 0.03)",
            padding: "6px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(0, 0, 0, 0.06)",
          }}
        >
          {timeString}
        </div>

        {/* Traditional Profile Icon with Dropdown Menu */}
        <ProfileMenu />
      </div>
    </header>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    try {
      await logout();
      window.location.href = "/login";
    } catch (e) {
      console.error("Logout error:", e);
      window.location.href = "/login";
    }
  };

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "50%",
          background: "#f1f5f9",
          border: "1.5px solid rgba(0, 0, 0, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 180ms ease",
          outline: "none",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(79, 70, 229, 0.4)";
          e.currentTarget.style.transform = "scale(1.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.1)";
          e.currentTarget.style.transform = "scale(1)";
        }}
        aria-label="User profile"
        title="User profile"
      >
        {/* Traditional profile user silhouette icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#334155"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: "220px",
            background: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(0, 0, 0, 0.08)",
            borderRadius: "14px",
            padding: "8px",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)",
            zIndex: 300,
            animation: "fadeIn 150ms ease",
          }}
        >
          {/* User Info Header */}
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
              marginBottom: "6px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
              Enterprise User
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
              Principal Engineer • Titan RAG
            </div>
          </div>

          {/* Menu Links */}
          <Link
            href="/app/profile"
            onClick={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 12px",
              borderRadius: "8px",
              fontSize: "13px",
              color: "#334155",
              textDecoration: "none",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            View Profile
          </Link>

          <Link
            href="/app/documents"
            onClick={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 12px",
              borderRadius: "8px",
              fontSize: "13px",
              color: "#334155",
              textDecoration: "none",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Document Corpus
          </Link>

          <div
            style={{
              height: "1px",
              background: "rgba(0, 0, 0, 0.06)",
              margin: "6px 8px",
            }}
          />

          {/* Log Out button */}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 12px",
              borderRadius: "8px",
              fontSize: "13px",
              color: "#ef4444",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}

export default WorkstationNavbar;
