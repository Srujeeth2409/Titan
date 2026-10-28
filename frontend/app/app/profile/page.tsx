"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  const userEmail = user?.email || "user@enterprise.com";
  const initials = userEmail.charAt(0).toUpperCase();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        padding: "48px 24px 80px 24px",
        color: "#0f172a",
        minHeight: "calc(100vh - 185px)",
      }}
    >
      <div
        data-grid-avoid
        style={{
          width: "100%",
          maxWidth: "640px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* ── Breadcrumb ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: "#64748b",
          }}
        >
          <Link
            href="/app"
            style={{
              color: "#4f46e5",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Workstation
          </Link>
          <span>›</span>
          <span style={{ color: "#0f172a", fontWeight: 600 }}>Profile</span>
        </div>

        {/* ── Profile Card ── */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.05)",
            padding: "40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
          }}
        >
          {/* Avatar Circle */}
          <div
            style={{
              width: "88px",
              height: "88px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #4f46e5, #6366f1, #3b82f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow:
                "0 4px 16px rgba(79, 70, 229, 0.3), 0 0 0 4px rgba(255, 255, 255, 0.9), 0 0 0 6px rgba(79, 70, 229, 0.15)",
            }}
          >
            <span
              style={{
                fontSize: "36px",
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.02em",
              }}
            >
              {initials}
            </span>
          </div>

          {/* Name & Role */}
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "#0f172a",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Enterprise User
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                margin: "4px 0 0 0",
              }}
            >
              Principal Engineer • Titan RAG
            </p>
          </div>

          {/* Status Pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 14px",
              borderRadius: "999px",
              background: "#dcfce7",
              border: "1px solid #bbf7d0",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#16a34a",
                boxShadow: "0 0 6px rgba(22, 163, 106, 0.5)",
              }}
            />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#166534" }}>
              Active Session
            </span>
          </div>
        </div>

        {/* ── Account Details Card ── */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Account Information
            </span>
          </div>

          {/* Fields */}
          <ProfileField label="Email" value={userEmail} />
          <ProfileField label="User ID" value={user?.id || "—"} mono />
          <ProfileField label="Role" value="Principal Engineer" />
          <ProfileField label="Organization" value="Enterprise" />
          <ProfileField label="Access Level" value="Full Corpus Access" />
          <ProfileField
            label="Token Type"
            value={user?.token_type || "Bearer"}
            mono
          />
        </div>

        {/* ── Workstation Info Card ── */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Workstation Details
            </span>
          </div>

          <ProfileField label="Platform" value="Titan RAG Workstation" />
          <ProfileField label="Vector Store" value="Qdrant" />
          <ProfileField label="Embedding Model" value="BGE (BAAI)" />
          <ProfileField label="Retrieval" value="Hybrid Dense + BM25" />
          <ProfileField label="Backend" value="FastAPI + PostgreSQL" />
        </div>

        {/* ── Quick Links ── */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/app"
            style={{
              flex: 1,
              minWidth: "160px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "14px 20px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(16px)",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
              fontSize: "14px",
              fontWeight: 600,
              color: "#4f46e5",
              textDecoration: "none",
              transition: "all 180ms ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Ask Questions
          </Link>

          <Link
            href="/app/documents"
            style={{
              flex: 1,
              minWidth: "160px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "14px 20px",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(16px)",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
              fontSize: "14px",
              fontWeight: 600,
              color: "#0f172a",
              textDecoration: "none",
              transition: "all 180ms ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Documents
          </Link>
        </div>

        {/* ── Log Out Button ── */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutLoading}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            width: "100%",
            padding: "14px 24px",
            borderRadius: "12px",
            background: logoutLoading ? "#fca5a5" : "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            fontSize: "14px",
            fontWeight: 600,
            cursor: logoutLoading ? "not-allowed" : "pointer",
            transition: "all 200ms ease",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {logoutLoading ? "Signing out…" : "Sign Out"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Reusable Profile Field Row
   ───────────────────────────────────────────────────────────────────────────── */

function ProfileField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 24px",
        borderBottom: "1px solid #f8fafc",
        transition: "background 150ms ease",
      }}
    >
      <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#0f172a",
          fontFamily: mono
            ? "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace"
            : "inherit",
          maxWidth: "320px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}
