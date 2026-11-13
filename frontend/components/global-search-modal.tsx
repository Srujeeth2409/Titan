"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Mail, CheckSquare, MessageSquare, Users, BookOpen, X, ArrowRight, Loader2 } from "lucide-react";
import { apiGlobalSearch, GlobalSearchResultItem } from "@/lib/api";

export function GlobalSearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, GlobalSearchResultItem[]>>({});
  const [totalHits, setTotalHits] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleCustomOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("titan:open-search", handleCustomOpen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("titan:open-search", handleCustomOpen);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults({});
      setTotalHits(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({});
      setTotalHits(0);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiGlobalSearch(query.trim());
        setResults(data.results || {});
        setTotalHits(data.total_hits || 0);
      } catch (err) {
        console.error("Global search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (link: string) => {
    setIsOpen(false);
    router.push(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white/95 rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[75vh]"
        style={{
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
        }}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across files, emails, chat, tasks, directory..."
            className="w-full bg-transparent border-0 outline-none text-slate-800 text-[15px] placeholder:text-slate-400"
          />
          {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
          {query && !loading && (
            <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
            ESC
          </span>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {!query.trim() && (
            <div className="py-12 text-center text-slate-400 text-sm">
              <p className="font-medium text-slate-600 mb-1">Quick Company Search</p>
              <p className="text-xs">Type a keyword to search authorized company data across apps</p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs">
                {["Employee Handbook", "Financial Review", "Architecture", "Sprint Tasks", "All-Hands"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {query.trim() && !loading && totalHits === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              No matching records found for &ldquo;<span className="text-slate-700">{query}</span>&rdquo;
            </div>
          )}

          {/* Render Categories */}
          {Object.entries(results).map(([cat, items]) => {
            if (!items || items.length === 0) return null;
            const categoryLabels: Record<string, { label: string; icon: any }> = {
              files: { label: "Files & Documents", icon: FileText },
              emails: { label: "Emails", icon: Mail },
              tasks: { label: "Tasks", icon: CheckSquare },
              messages: { label: "Chat Messages", icon: MessageSquare },
              employees: { label: "Employee Directory", icon: Users },
              documents: { label: "Titan RAG Documents", icon: BookOpen },
            };

            const meta = categoryLabels[cat] || { label: cat, icon: FileText };
            const Icon = meta.icon;

            return (
              <div key={cat} className="space-y-1">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  <span>{meta.label}</span>
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.link)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-50/70 transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-600">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-indigo-500 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            {totalHits > 0 ? `${totalHits} result${totalHits === 1 ? "" : "s"} found` : "Titan Enterprise Unified Search"}
          </span>
          <span className="flex items-center gap-2">
            <span>Navigate: ↑↓</span>
            <span>Open: ↵</span>
          </span>
        </div>
      </div>
    </div>
  );
}

