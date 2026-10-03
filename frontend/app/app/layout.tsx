"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getDocuments, getHealth } from "@/lib/api";

const navItems = [
  { href: "/app", label: "Ask" },
  { href: "/app/documents", label: "Documents" },
];

function BrandMark() {
  return (
    <svg viewBox="0 0 25 25" fill="none" className="workspace-brand-logo">
      <clipPath id="brand-ws">
        <circle cx="12.5" cy="12.5" r="12.5" />
      </clipPath>
      <g clipPath="url(#brand-ws)">
        <rect width="25" height="25" fill="#F3EFE7" />
        <path d="M12.5 0 L25 12.5 L12.5 25 Z" fill="#C45D3A" />
        <path d="M0 12.5 L12.5 0 L12.5 12.5 Z" fill="#E2D6C8" />
        <path d="M12.5 12.5 L25 12.5 L12.5 25 Z" fill="#FFFEFB" opacity="0.9" />
        <path d="M0 12.5 L12.5 12.5 L6.25 25 Z" fill="#8A4A32" />
        <polygon points="12.5,4 18,12.5 12.5,21 7,12.5" fill="#FFFEFB" />
        <polygon points="12.5,7 15.5,12.5 12.5,18 9.5,12.5" fill="#C45D3A" />
      </g>
    </svg>
  );
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [online, setOnline] = useState(true);
  const [collections, setCollections] = useState<{ name: string; count: number }[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    getHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));

    getDocuments()
      .then((res) => {
        const docs = Array.isArray(res?.documents) ? res.documents : [];
        const counts = new Map<string, number>();
        docs.forEach((d: { collection?: string }) => {
          const name = d.collection || "default";
          counts.set(name, (counts.get(name) || 0) + 1);
        });
        const rows = Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
        setCollections(rows.length ? rows : [{ name: "default", count: 0 }]);
      })
      .catch(() => setCollections([{ name: "default", count: 0 }]));
  }, []);

  const crumb = pathname.startsWith("/app/documents") ? "Documents" : "Ask";

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand">
          <BrandMark />
          <span className="workspace-brand-copy">
            <span className="workspace-brand-text">Titan</span>
            <span className="workspace-brand-mark">Cited retrieval</span>
          </span>
        </Link>

        <nav className="workspace-nav">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/app" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`workspace-nav-item ${isActive ? "active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="workspace-nav-label">Collections</div>
        <div className="workspace-collection-list">
          {collections.map((c) => (
            <div key={c.name} className="workspace-collection-item">
              <span>{c.name}</span>
              <span className="workspace-collection-count">{c.count}</span>
            </div>
          ))}
        </div>

        <div className="workspace-sidebar-spacer" />

        <div className="workspace-sidebar-foot">
          <div className={`workspace-status-pill ${online ? "" : "offline"}`}>
            <span className="workspace-status-dot" />
            <span>{online ? "Gateway online" : "Gateway offline"}</span>
          </div>
          {mounted && (
            <span className="workspace-kbd">
              ⌘K to focus ask
            </span>
          )}
        </div>
      </aside>

      <div className="workspace-main">
        <div className="workspace-topbar">
          <p className="workspace-crumb">
            Workspace / <strong>{crumb}</strong>
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
