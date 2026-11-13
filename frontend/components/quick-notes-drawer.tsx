"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Pin, Trash2, Check, Loader2 } from "lucide-react";
import { apiGetNotes, apiCreateNote, apiUpdateNote, apiDeleteNote, QuickNoteItem } from "@/lib/api";

const NOTE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900" },
  amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900" },
  purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-900" },
  rose: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-900" },
};

export function QuickNotesDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState<QuickNoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("titan:open-notes", handleOpen);
    return () => window.removeEventListener("titan:open-notes", handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadNotes();
    }
  }, [isOpen]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await apiGetNotes();
      setNotes(data.notes || []);
      if (data.notes && data.notes.length > 0 && !activeNoteId) {
        setActiveNoteId(data.notes[0].id);
      }
    } catch (err) {
      console.error("Failed to load quick notes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await apiCreateNote({
        title: "New Quick Note",
        content: "",
        color: "blue",
        is_pinned: false,
      });
      if (res.note) {
        setNotes((prev) => [res.note, ...prev]);
        setActiveNoteId(res.note.id);
      }
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<QuickNoteItem>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates } : n))
    );
    try {
      await apiUpdateNote(id, updates);
    } catch (err) {
      console.error("Failed to update note:", err);
    }
  };

  const handleDelete = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNoteId === id) {
      setActiveNoteId(notes.find((n) => n.id !== id)?.id || null);
    }
    try {
      await apiDeleteNote(id);
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  if (!isOpen) return null;

  const activeNote = notes.find((n) => n.id === activeNoteId);

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/20 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-md h-full bg-white shadow-2xl border-l border-slate-200/80 flex flex-col slide-in-from-right duration-200"
        style={{
          boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.08)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 text-[15px]">Quick Notes</span>
            <span className="text-xs text-slate-400 font-mono">({notes.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Note Selector Pills */}
            <div className="p-3 border-b border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar">
              {notes.map((n) => {
                const isActive = n.id === activeNoteId;
                return (
                  <button
                    key={n.id}
                    onClick={() => setActiveNoteId(n.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {n.is_pinned && <Pin className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
                    <span className="max-w-[100px] truncate">{n.title || "Untitled"}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Note Editor */}
            {activeNote ? (
              <div
                className={`flex-1 flex flex-col p-5 transition-colors ${
                  NOTE_COLORS[activeNote.color]?.bg || "bg-white"
                }`}
              >
                {/* Note Controls */}
                <div className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-1.5">
                    {Object.keys(NOTE_COLORS).map((c) => (
                      <button
                        key={c}
                        onClick={() => handleUpdate(activeNote.id, { color: c })}
                        className={`w-5 h-5 rounded-full border transition-transform ${
                          activeNote.color === c ? "scale-110 border-slate-900 ring-2 ring-slate-900/20" : "border-slate-300"
                        }`}
                        style={{
                          backgroundColor:
                            c === "blue" ? "#3b82f6" : c === "amber" ? "#f59e0b" : c === "emerald" ? "#10b981" : c === "purple" ? "#8b5cf6" : "#f43f5e",
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdate(activeNote.id, { is_pinned: !activeNote.is_pinned })}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        activeNote.is_pinned
                          ? "bg-amber-100 border-amber-300 text-amber-700"
                          : "border-slate-200 text-slate-400 hover:text-slate-600"
                      }`}
                      title="Toggle Pin"
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(activeNote.id)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                      title="Delete Note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title Input */}
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => handleUpdate(activeNote.id, { title: e.target.value })}
                  placeholder="Note Title..."
                  className="w-full bg-transparent border-0 outline-none text-base font-semibold text-slate-900 placeholder:text-slate-400 mb-2"
                />

                {/* Content Textarea */}
                <textarea
                  value={activeNote.content}
                  onChange={(e) => handleUpdate(activeNote.id, { content: e.target.value })}
                  placeholder="Type notes, meeting bullets, or scratchpad thoughts..."
                  className="w-full flex-1 bg-transparent border-0 outline-none resize-none text-sm text-slate-700 leading-relaxed placeholder:text-slate-400"
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
                <p>No note selected</p>
                <button
                  onClick={handleCreate}
                  className="mt-2 text-indigo-600 font-medium hover:underline"
                >
                  Create one now
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

