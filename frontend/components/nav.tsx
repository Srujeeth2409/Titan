"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function Nav() {
  const [timeString, setTimeString] = useState<string>("");

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      // Format: 9:47 PM • 14 July 2026 (or current date/time)
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const dateStr = now.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      setTimeString(`${timeStr} • ${dateStr}`);
    }

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "24px 48px",
      backgroundColor: "transparent",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Left: Logo & Nav items */}
      <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
        {/* Crosshair / target logo matching screenshot */}
        <Link href="/" style={{ display: "flex", alignItems: "center", color: "#ffffff", textDecoration: "none" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
        </Link>

        {/* Links */}
        <nav style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <Link
            href="/"
            style={{
              position: "relative",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
              paddingBottom: "6px",
            }}
          >
            Home
            {/* White active bar underneath Home */}
            <span style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "2px",
              backgroundColor: "#ffffff",
              borderRadius: "1px",
            }} />
          </Link>
          <a
            href="#about"
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: "0.875rem",
              fontWeight: 400,
              textDecoration: "none",
              transition: "color 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)")}
          >
            About
          </a>
          <a
            href="#services"
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: "0.875rem",
              fontWeight: 400,
              textDecoration: "none",
              transition: "color 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)")}
          >
            Services
          </a>
          <a
            href="#contact"
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: "0.875rem",
              fontWeight: 400,
              textDecoration: "none",
              transition: "color 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)")}
          >
            Contact
          </a>
        </nav>
      </div>

      {/* Right: Timezone block & Sign In button */}
      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        {/* Timezone display */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          borderLeft: "1px solid rgba(255, 255, 255, 0.15)",
          paddingLeft: "16px",
        }}>
          <span style={{ fontSize: "0.6875rem", color: "rgba(255, 255, 255, 0.5)", letterSpacing: "0.02em" }}>
            Timezone
          </span>
          <span style={{ fontSize: "0.8125rem", color: "rgba(255, 255, 255, 0.9)", fontWeight: 400, whiteSpace: "nowrap" }}>
            {timeString || "9:47 PM • 14 July 2026"}
          </span>
        </div>

        {/* White pill Sign In button */}
        <Link
          href="/app"
          style={{
            backgroundColor: "#ffffff",
            color: "#000000",
            fontSize: "0.875rem",
            fontWeight: 500,
            padding: "8px 24px",
            borderRadius: "9999px",
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            transition: "all 150ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.9)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
        >
          Sign In
        </Link>
      </div>
    </header>
  );
}
