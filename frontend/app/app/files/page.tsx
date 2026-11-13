"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  getDocuments,
  ingestDocument,
  copyDocument,
  deleteDocument,
  getDocumentDownloadUrl,
  TitanApiError,
} from "@/lib/api";
import GlassFolder, { ArtPreset } from "@/components/ui/glass-folder-cards";

export interface DocumentItem {
  id: string;
  filename: string;
  source_type: string;
  collection: string;
  status: string;
  page_count?: number;
  chunk_count?: number;
  created_at?: string;
  metadata?: any;
}
import {
  Folder,
  FileText,
  UploadCloud,
  Plus,
  Trash2,
  Download,
  MessageSquare,
  Search,
  Check,
  ChevronRight,
  Loader2,
  MoveRight,
} from "lucide-react";

export default function FilesExplorerPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [userFolders, setUserFolders] = useState<string[]>(["Project Management"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [draggingOverFolder, setDraggingOverFolder] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFolders();
    fetchDocs();
  }, []);

  const loadFolders = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("titan_user_folders");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUserFolders(parsed);
          }
        } catch {}
      }
    }
  };

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await getDocuments();
      if (res?.documents) setDocuments(res.documents);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  };

  const allFolders = useMemo(() => {
    const set = new Set<string>(["default"]);
    documents.forEach((d) => {
      if (d.collection) set.add(d.collection);
    });
    userFolders.forEach((f) => set.add(f));
    return Array.from(set);
  }, [documents, userFolders]);

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      const matchesFolder =
        selectedFolder === "all" ||
        (d.collection || "default").toLowerCase() === selectedFolder.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        d.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.collection || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFolder && matchesSearch;
    });
  }, [documents, selectedFolder, searchQuery]);

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFolderName.trim();
    if (!clean) return;
    if (!userFolders.includes(clean)) {
      const next = [...userFolders, clean];
      setUserFolders(next);
      localStorage.setItem("titan_user_folders", JSON.stringify(next));
      setToastMessage(`Folder "${clean}" created.`);
      setTimeout(() => setToastMessage(null), 3000);
    }
    setSelectedFolder(clean);
    setNewFolderName("");
    setIsCreateFolderOpen(false);
  };

  const handleFileUpload = async (files: FileList | null, targetCol: string) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        await ingestDocument(file, targetCol === "all" ? "default" : targetCol);
      }
      setToastMessage(`Indexed ${files.length} file(s) into "${targetCol}".`);
      setTimeout(() => setToastMessage(null), 3500);
      await fetchDocs();
    } catch (err: any) {
      setToastMessage(`Upload failed: ${err.message || "Error"}`);
    } finally {
      setIsUploading(false);
    }
  };

  const presets: ArtPreset[] = ["aurora", "ember", "dusk", "glacier", "verdant"];

  return (
    <div className="max-w-7xl mx-auto w-full px-6 py-6 min-h-[calc(100vh-180px)] flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900 tracking-tight">Enterprise Files & Directories</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
              {documents.length} Files Indexed
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Browse corporate directories, drag-and-drop documents into target folders, or query folder-specific knowledge.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files or folders..."
              className="pl-9 pr-4 py-1.5 bg-slate-50 text-xs rounded-xl border border-slate-200 outline-none w-56 focus:border-indigo-500 transition-all"
            />
          </div>

          <button
            onClick={() => setIsCreateFolderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Folder</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files, selectedFolder)}
          />
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold rounded-xl flex items-center justify-between shadow-xs">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-indigo-400 hover:text-indigo-600">✕</button>
        </div>
      )}

      {/* Directory Folders Grid (Always on top) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Workstation Folders ({allFolders.length})
          </span>
          <span className="text-[11px] text-slate-400">
            Click folder to filter or drag files from table below to copy
          </span>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto pb-4 pt-1">
          {allFolders.map((folderName, idx) => {
            const folderDocs = documents.filter(
              (d) => (d.collection || "default").toLowerCase() === folderName.toLowerCase()
            );
            const isSelected = selectedFolder.toLowerCase() === folderName.toLowerCase();
            const isDraggingOver = draggingOverFolder === folderName;

            return (
              <div
                key={folderName}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "copy";
                  setDraggingOverFolder(folderName);
                }}
                onDragLeave={() => setDraggingOverFolder(null)}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraggingOverFolder(null);

                  const draggedDocId = e.dataTransfer.getData("application/x-titan-doc-id");
                  const draggedDocName = e.dataTransfer.getData("application/x-titan-doc-name");
                  if (draggedDocId) {
                    try {
                      await copyDocument(draggedDocId, folderName);
                      setToastMessage(`Copied "${draggedDocName || "file"}" into "${folderName}".`);
                      setTimeout(() => setToastMessage(null), 3500);
                      await fetchDocs();
                    } catch (err: any) {
                      setToastMessage(`Copy failed: ${err.message || "Error"}`);
                    }
                    return;
                  }

                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    await handleFileUpload(files, folderName);
                  }
                }}
                onClick={() => setSelectedFolder(isSelected ? "all" : folderName)}
                className={`relative shrink-0 transition-transform duration-200 cursor-pointer ${
                  isDraggingOver
                    ? "scale-105 ring-4 ring-indigo-500/40 rounded-2xl"
                    : isSelected
                    ? "ring-2 ring-indigo-600 rounded-2xl"
                    : ""
                }`}
              >
                <GlassFolder
                  label={folderName}
                  meta={`${folderDocs.length} ${folderDocs.length === 1 ? "file" : "files"}`}
                  art={presets[idx % presets.length]}
                  tone="light"
                  action="add"
                  onAdd={() => {
                    fileInputRef.current?.click();
                  }}
                  files={folderDocs.map((d) => ({
                    name: d.filename,
                    meta: d.chunk_count ? `${d.chunk_count} chunks` : undefined,
                  }))}
                  menu={[
                    {
                      label: isSelected ? "Show All Files" : `Filter by "${folderName}"`,
                      onSelect: () => setSelectedFolder(isSelected ? "all" : folderName),
                    },
                    {
                      label: `Ask in "${folderName}"`,
                      onSelect: () => window.location.href = `/app?collection=${encodeURIComponent(folderName)}`,
                    },
                  ]}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Files Table under Folders */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex-1 flex flex-col">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">
              {selectedFolder === "all" ? "All Files" : `Folder: ${selectedFolder}`}
            </span>
            <span className="text-[11px] text-slate-400">
              ({filteredDocs.length} {filteredDocs.length === 1 ? "item" : "items"})
            </span>
          </div>

          {selectedFolder !== "all" && (
            <Link
              href={`/app?collection=${encodeURIComponent(selectedFolder)}`}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>Ask Titan AI about this folder</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/40 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4">Directory / Folder</th>
                <th className="py-3 px-4">Chunks</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No files found in this directory. Drag and drop files above or click "Upload File".
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-titan-doc-id", doc.id);
                      e.dataTransfer.setData("application/x-titan-doc-name", doc.filename);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="hover:bg-slate-50/80 transition-colors group cursor-grab active:cursor-grabbing"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      <span className="text-slate-400 text-xs">⠿</span>
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="truncate max-w-md">{doc.filename}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                        {doc.collection || "default"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {doc.chunk_count || 1}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Indexed</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <Link
                          href={`/app?collection=${encodeURIComponent(doc.collection || "default")}`}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg flex items-center gap-1"
                          title="Ask questions grounded in this file"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>Ask</span>
                        </Link>
                        <a
                          href={getDocumentDownloadUrl(doc.id)}
                          download={doc.filename}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Folder */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Create New Directory / Folder</h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Project Management"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 outline-none focus:border-indigo-600"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateFolderOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
