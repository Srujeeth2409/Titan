"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { getDocuments, ingestDocument, getDocumentDownloadUrl, moveDocument, copyDocument, TitanApiError } from "@/lib/api";
import { HaloDropzone } from "@/components/ui/halo-dropzone";
import { moveToTrash, useTrash } from "@/lib/trash-store";
import GlassFolder, { ArtPreset } from "@/components/ui/glass-folder-cards";

interface DocumentItem {
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

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string; trace_id?: string } | null>(null);

  // Ingestion state
  const [uploadCollection, setUploadCollection] = useState("default");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // User-created folders state (folders ONLY appear when created by the user)
  const [userFolders, setUserFolders] = useState<string[]>([]);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [draggingOverFolder, setDraggingOverFolder] = useState<string | null>(null);
  const [targetFolderForUpload, setTargetFolderForUpload] = useState<string | null>(null);
  const folderFileInputRef = useRef<HTMLInputElement>(null);

  const { trash } = useTrash();

  // Load custom folders from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("titan_user_folders");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setUserFolders(parsed);
        }
      }
    } catch (e) {
      console.error("Error loading titan_user_folders:", e);
    }
  }, []);

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newFolderName.trim();
    if (!cleanName) return;

    if (!userFolders.some((f) => f.toLowerCase() === cleanName.toLowerCase())) {
      const updated = [...userFolders, cleanName];
      setUserFolders(updated);
      try {
        localStorage.setItem("titan_user_folders", JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      setUploadCollection(cleanName);
      setSelectedFilter(cleanName);
      setToastMessage(`Created folder "${cleanName}" and set as active upload target.`);
      setTimeout(() => setToastMessage(null), 4000);
    }
    setNewFolderName("");
    setIsFolderModalOpen(false);
  };

  const handleDeleteFolder = (folderName: string) => {
    const updated = userFolders.filter((f) => f.toLowerCase() !== folderName.toLowerCase());
    setUserFolders(updated);
    try {
      localStorage.setItem("titan_user_folders", JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
    if (selectedFilter.toLowerCase() === folderName.toLowerCase()) {
      setSelectedFilter("all");
    }
    if (uploadCollection.toLowerCase() === folderName.toLowerCase()) {
      setUploadCollection("default");
    }
    setToastMessage(`Removed folder "${folderName}".`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDocuments();
      if (res?.documents && Array.isArray(res.documents)) {
        setDocuments(res.documents);
      }
    } catch (err: any) {
      if (err instanceof TitanApiError) {
        setError({ message: err.message, code: err.code, trace_id: err.traceId });
      } else {
        setError({ message: err.message || "Failed to load documents." });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();

    // Listen to document restoration from macOS Dock Trash
    const handleRestore = () => {
      fetchDocs();
      setToastMessage("Document restored from Trash to active corpus.");
      setTimeout(() => setToastMessage(null), 4000);
    };

    window.addEventListener("titan:document-restored", handleRestore);
    return () => window.removeEventListener("titan:document-restored", handleRestore);
  }, []);

  // Filter out any documents that are currently in the trash
  const activeDocuments = useMemo(() => {
    const trashedIds = new Set(trash.map((t) => t.id));
    return documents.filter((d) => !trashedIds.has(d.id));
  }, [documents, trash]);

  // Unique collections for filter pills (incorporates user folders and collections)
  const availableCollections = useMemo(() => {
    const set = new Set<string>();
    activeDocuments.forEach((d) => {
      if (d.collection) set.add(d.collection);
    });
    userFolders.forEach((f) => set.add(f));
    return Array.from(set);
  }, [activeDocuments, userFolders]);

  // Filtered by collection & search
  const filteredDocuments = useMemo(() => {
    return activeDocuments.filter((d) => {
      const matchesCol =
        selectedFilter === "all" ||
        (d.collection || "").toLowerCase() === selectedFilter.toLowerCase();
      const matchesSearch =
        searchQuery.trim() === "" ||
        d.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.collection || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCol && matchesSearch;
    });
  }, [activeDocuments, selectedFilter, searchQuery]);

  const handleFileUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadSuccess(null);

    const targetCol = uploadCollection.trim() || "default";
    let successCount = 0;
    let lastResultName = "";

    try {
      for (const file of files) {
        await ingestDocument(file, targetCol);
        successCount++;
        lastResultName = file.name;
      }

      if (successCount === 1) {
        setUploadSuccess(`Successfully indexed "${lastResultName}" into collection "${targetCol}"`);
      } else {
        setUploadSuccess(`Successfully indexed ${successCount} documents into collection "${targetCol}"`);
      }
      await fetchDocs();
    } catch (err: any) {
      if (err instanceof TitanApiError) {
        setError({ message: err.message, code: err.code, trace_id: err.traceId });
      } else {
        setError({ message: err.message || "Document indexing failed." });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUploadForFolder = async (files: File[], targetFolder: string) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadSuccess(null);

    const targetCol = targetFolder.trim() || "default";
    let successCount = 0;
    let lastResultName = "";

    try {
      for (const file of files) {
        await ingestDocument(file, targetCol);
        successCount++;
        lastResultName = file.name;
      }

      if (successCount === 1) {
        setUploadSuccess(`Successfully dropped and indexed "${lastResultName}" into folder "${targetCol}"`);
      } else {
        setUploadSuccess(`Successfully dropped and indexed ${successCount} files into folder "${targetCol}"`);
      }
      setSelectedFilter(targetCol);
      await fetchDocs();
    } catch (err: any) {
      if (err instanceof TitanApiError) {
        setError({ message: err.message, code: err.code, trace_id: err.traceId });
      } else {
        setError({ message: err.message || "Document indexing failed." });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleMoveToTrash = (doc: DocumentItem) => {
    moveToTrash({
      id: doc.id,
      filename: doc.filename,
      collection: doc.collection || "default",
      source_type: doc.source_type,
      chunk_count: doc.chunk_count,
      page_count: doc.page_count,
    });

    setToastMessage(`Moved "${doc.filename}" to Trash in macOS Dock.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const statusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "indexed":
        return "#16a34a";
      case "processing":
      case "indexing":
        return "#2563eb";
      case "queued":
        return "#d97706";
      case "failed":
        return "#dc2626";
      default:
        return "#64748b";
    }
  };

  const getFormatBadgeColor = (type: string) => {
    const t = type?.toLowerCase() || "";
    if (t.includes("pdf")) return { bg: "#fee2e2", text: "#dc2626" };
    if (t.includes("doc")) return { bg: "#dbeafe", text: "#2563eb" };
    if (t.includes("md") || t.includes("markdown")) return { bg: "#f3e8ff", text: "#9333ea" };
    if (t.includes("txt") || t.includes("text")) return { bg: "#ffedd5", text: "#ea580c" };
    if (t.includes("json") || t.includes("csv")) return { bg: "#fef9c3", text: "#ca8a04" };
    return { bg: "#f1f5f9", text: "#475569" };
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        padding: "36px 32px 180px 32px",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1080px",
          display: "flex",
          flexDirection: "column",
          gap: "28px",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 12px",
                borderRadius: "999px",
                background: "#fef3c7",
                border: "1px solid #fde68a",
                marginBottom: "10px",
                fontSize: "11px",
                fontWeight: 600,
                color: "#b45309",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 4a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" />
              </svg>
              Document Corpus
            </div>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "#0f172a",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Enterprise Documents
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                margin: "6px 0 0 0",
                maxWidth: "600px",
                lineHeight: 1.5,
              }}
            >
              Upload internal runbooks, specs, and policies. Files are parsed, recursively chunked,
              embedded with BGE vectors, and synchronized with Qdrant.
            </p>
          </div>

          {/* Collection Target & Status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              padding: "8px 14px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <label
                htmlFor="target-collection-input"
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: "#64748b",
                  letterSpacing: "0.05em",
                }}
              >
                Target Collection / Folder
              </label>
              <input
                id="target-collection-input"
                type="text"
                value={uploadCollection}
                onChange={(e) => setUploadCollection(e.target.value)}
                placeholder="default"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#0f172a",
                  fontSize: "13px",
                  fontWeight: 600,
                  width: "160px",
                  padding: "2px 0",
                }}
              />
            </div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "#475569",
                background: "#e2e8f0",
                padding: "4px 8px",
                borderRadius: "6px",
              }}
            >
              {activeDocuments.length} active doc{activeDocuments.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* ── Toast Banners ── */}
        {toastMessage && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px",
              borderRadius: "12px",
              background: "#e0e7ff",
              border: "1px solid #c7d2fe",
              color: "#3730a3",
              fontSize: "13px",
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "14px" }}
            >
              ✕
            </button>
          </div>
        )}

        {uploadSuccess && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px",
              borderRadius: "12px",
              background: "#dcfce7",
              border: "1px solid #bbf7d0",
              color: "#166534",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{uploadSuccess}</span>
            </div>
            <button
              onClick={() => setUploadSuccess(null)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px 18px",
              borderRadius: "12px",
              background: "#fee2e2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{error.message}</span>
            <button
              onClick={() => setError(null)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── User-Created Folders Section (ALWAYS ON TOP) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", width: "100%", marginTop: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#475569",
                }}
              >
                My Folders ({userFolders.length})
              </span>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                — Click to view files or drag files from table / desktop below
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFolderModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                fontWeight: 600,
                color: "#4f46e5",
                background: "#eef2ff",
                border: "1px solid #c7d2fe",
                padding: "4px 10px",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              + Add Folder
            </button>
          </div>

          {userFolders.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "20px",
                width: "100%",
              }}
            >
              {userFolders.map((folderName, idx) => {
                const folderDocs = activeDocuments.filter(
                  (d) => (d.collection || "").toLowerCase() === folderName.toLowerCase()
                );
                const presets: ArtPreset[] = ["aurora", "ember", "dusk", "glacier", "verdant"];
                const preset = presets[idx % presets.length];
                const isSelected = selectedFilter.toLowerCase() === folderName.toLowerCase();
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
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggingOverFolder === folderName) {
                        setDraggingOverFolder(null);
                      }
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDraggingOverFolder(null);

                      // 1. Check if an existing document row was dragged from the table below
                      const draggedDocId = e.dataTransfer.getData("application/x-titan-doc-id");
                      const draggedDocName = e.dataTransfer.getData("application/x-titan-doc-name");
                      if (draggedDocId) {
                        try {
                          await copyDocument(draggedDocId, folderName);
                          setToastMessage(`Copied "${draggedDocName || "document"}" into folder "${folderName}".`);
                          setTimeout(() => setToastMessage(null), 3500);
                          await fetchDocs();
                        } catch (err: any) {
                          setError({ message: err?.message || "Failed to copy document to folder." });
                        }
                        return;
                      }

                      // 2. Otherwise handle dropped files from the user's OS
                      const droppedFiles = Array.from(e.dataTransfer.files);
                      if (droppedFiles.length > 0) {
                        await handleFileUploadForFolder(droppedFiles, folderName);
                      }
                    }}
                    style={{
                      cursor: "pointer",
                      outline: isDraggingOver
                        ? "2.5px dashed #4f46e5"
                        : isSelected
                        ? "2px solid #6366f1"
                        : "none",
                      boxShadow: isDraggingOver
                        ? "0 0 28px rgba(79, 70, 229, 0.45)"
                        : "none",
                      borderRadius: "18px",
                      transform: isDraggingOver ? "scale(1.04)" : "none",
                      transition: "all 180ms ease",
                      position: "relative",
                    }}
                    onClick={() => {
                      setSelectedFilter(isSelected ? "all" : folderName);
                    }}
                  >
                    {isDraggingOver && (
                      <div
                        style={{
                          position: "absolute",
                          top: "-12px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "#4f46e5",
                          color: "#ffffff",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "4px 12px",
                          borderRadius: "999px",
                          zIndex: 60,
                          boxShadow: "0 4px 14px rgba(79, 70, 229, 0.5)",
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                        }}
                      >
                        📥 Drop to add into {folderName}
                      </div>
                    )}
                    <GlassFolder
                      label={folderName}
                      meta={`${folderDocs.length} ${folderDocs.length === 1 ? "file" : "files"}`}
                      art={preset}
                      tone="light"
                      action="add"
                      onAdd={() => {
                        setTargetFolderForUpload(folderName);
                        folderFileInputRef.current?.click();
                      }}
                      files={folderDocs.map((d) => ({
                        name: d.filename,
                        meta: d.chunk_count ? `${d.chunk_count} chunks` : undefined,
                        href: `/app`,
                      }))}
                      menu={[
                        {
                          label: "Upload file to this folder…",
                          onSelect: () => {
                            setTargetFolderForUpload(folderName);
                            folderFileInputRef.current?.click();
                          },
                        },
                        {
                          label: isSelected ? "Show All Documents" : `Filter by "${folderName}"`,
                          onSelect: () => setSelectedFilter(isSelected ? "all" : folderName),
                        },
                        {
                          label: "Set as Default Upload Target",
                          onSelect: () => {
                            setUploadCollection(folderName);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          },
                        },
                        {
                          label: "Delete Folder",
                          danger: true,
                          onSelect: () => handleDeleteFolder(folderName),
                        },
                      ]}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              onClick={() => setIsFolderModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                padding: "24px",
                borderRadius: "16px",
                background: "rgba(255, 255, 255, 0.6)",
                border: "1.5px dashed #cbd5e1",
                color: "#64748b",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#4f46e5";
                e.currentTarget.style.color = "#4f46e5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#cbd5e1";
                e.currentTarget.style.color = "#64748b";
              }}
            >
              <span>📁 No folders yet. Click here or "+ Add Folder" to create your first folder</span>
            </div>
          )}
        </div>

        {/* ── HaloDropzone Integration (BELOW FOLDERS) ── */}
        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <HaloDropzone
            accept=".pdf,.docx,.md,.txt,.csv,.json,.log"
            multiple={true}
            disabled={isUploading}
            emptyLabel={isUploading ? "Chunking & indexing into vectors…" : "Drop internal files here or click to browse"}
            formatHint="PDF, DOCX, Markdown (.md), TXT, CSV, JSON, LOG up to 25MB"
            successLabel="Indexed into knowledge corpus"
            onFiles={handleFileUpload}
            className="w-full max-w-3xl"
          />
        </div>

        {/* Hidden input to allow clicking folder to upload from local disk */}
        <input
          ref={folderFileInputRef}
          type="file"
          multiple
          className="hidden"
          style={{ display: "none" }}
          onChange={async (e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            if (files.length > 0 && targetFolderForUpload) {
              await handleFileUploadForFolder(files, targetFolderForUpload);
            }
            if (e.target) e.target.value = "";
          }}
        />

        {/* ── Filters & Search Bar ── */}
        <div
          id="collections"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          {/* Collection Pills + New Folder Trigger */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setSelectedFilter("all")}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: selectedFilter === "all" ? "#4f46e5" : "#f1f5f9",
                color: selectedFilter === "all" ? "#ffffff" : "#475569",
                boxShadow: selectedFilter === "all" ? "0 2px 6px rgba(79, 70, 229, 0.25)" : "none",
                transition: "all 150ms ease",
              }}
            >
              All ({activeDocuments.length})
            </button>
            {availableCollections.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setSelectedFilter(col)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: selectedFilter === col ? "#4f46e5" : "#f1f5f9",
                  color: selectedFilter === col ? "#ffffff" : "#475569",
                  boxShadow: selectedFilter === col ? "0 2px 6px rgba(79, 70, 229, 0.25)" : "none",
                  transition: "all 150ms ease",
                }}
              >
                {col}
              </button>
            ))}

            {/* + New Folder Button */}
            <button
              type="button"
              onClick={() => setIsFolderModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                border: "1px dashed #94a3b8",
                background: "#ffffff",
                color: "#475569",
                cursor: "pointer",
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#4f46e5";
                e.currentTarget.style.color = "#4f46e5";
                e.currentTarget.style.background = "#f5f3ff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#94a3b8";
                e.currentTarget.style.color = "#475569";
                e.currentTarget.style.background = "#ffffff";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Folder
            </button>
          </div>

          {/* Search filter */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "6px 12px",
              minWidth: "220px",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Filter documents…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#0f172a",
                fontSize: "12px",
                width: "100%",
              }}
            />
          </div>
        </div>

        {/* ── Documents Table Container (Clean White Apple-Grade Table) ── */}
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "60px 0",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#4f46e5",
                animation: "pulse 1.5s infinite",
              }}
            />
            <span>Fetching indexed documents from Qdrant & database…</span>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              borderRadius: "16px",
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#f1f5f9",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                marginBottom: "12px",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>
              No documents found
            </div>
            <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
              {searchQuery ? "Try refining your search query." : "Upload documents using the dropzone above to begin indexing."}
            </p>
          </div>
        ) : (
          <div
            style={{
              borderRadius: "16px",
              background: "rgba(255, 255, 255, 0.88)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
              width: "100%",
            }}
          >
            <div
              style={{
                width: "100%",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth: "860px",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "13px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      color: "#64748b",
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <th style={{ padding: "14px 20px", minWidth: "260px" }}>Document</th>
                    <th style={{ padding: "14px 16px", minWidth: "90px" }}>Format</th>
                    <th style={{ padding: "14px 16px", minWidth: "150px" }}>Collection / Folder</th>
                    <th style={{ padding: "14px 16px", minWidth: "100px" }}>Status</th>
                    <th style={{ padding: "14px 16px", minWidth: "90px" }}>Chunks</th>
                    <th style={{ padding: "14px 16px", minWidth: "110px" }}>Uploaded</th>
                    <th style={{ padding: "14px 24px", minWidth: "250px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
              <tbody>
                {filteredDocuments.map((doc, idx) => {
                  const badge = getFormatBadgeColor(doc.source_type);
                  return (
                    <tr
                      key={doc.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-titan-doc-id", doc.id);
                        e.dataTransfer.setData("application/x-titan-doc-name", doc.filename);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      style={{
                        borderBottom:
                          idx === filteredDocuments.length - 1
                            ? "none"
                            : "1px solid #f1f5f9",
                        transition: "background 150ms ease",
                        cursor: "grab",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Document Name — Draggable handle */}
                      <td style={{ padding: "14px 20px" }}>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: "10px" }}
                          title="Drag this document onto any folder above to copy it"
                        >
                          {/* Drag handle icon indicator */}
                          <div
                            style={{
                              color: "#cbd5e1",
                              display: "flex",
                              alignItems: "center",
                              cursor: "grab",
                            }}
                            title="Drag to copy into folder"
                          >
                            <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
                              <circle cx="2" cy="2" r="1.5" />
                              <circle cx="8" cy="2" r="1.5" />
                              <circle cx="2" cy="8" r="1.5" />
                              <circle cx="8" cy="8" r="1.5" />
                              <circle cx="2" cy="14" r="1.5" />
                              <circle cx="8" cy="14" r="1.5" />
                            </svg>
                          </div>
                          <div
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "7px",
                              background: badge.bg,
                              color: badge.text,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <span
                            style={{
                              fontWeight: 600,
                              color: "#0f172a",
                              maxWidth: "280px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {doc.filename}
                          </span>
                        </div>
                      </td>

                      {/* Format Badge */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "3px 8px",
                            borderRadius: "5px",
                            background: badge.bg,
                            color: badge.text,
                          }}
                        >
                          {doc.source_type?.toUpperCase() || "FILE"}
                        </span>
                      </td>

                      {/* Collection */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 500,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "#f1f5f9",
                            color: "#334155",
                            fontFamily: "'SF Mono', monospace",
                          }}
                        >
                          {doc.collection || "default"}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: statusColor(doc.status),
                            }}
                          />
                          <span style={{ fontSize: "12px", fontWeight: 500, color: statusColor(doc.status), textTransform: "capitalize" }}>
                            {doc.status}
                          </span>
                        </div>
                      </td>

                      {/* Chunk count */}
                      <td style={{ padding: "14px 16px", color: "#64748b", fontSize: "12px" }}>
                        {doc.chunk_count ? `${doc.chunk_count} chunks` : "—"}
                      </td>

                      {/* Uploaded date */}
                      <td style={{ padding: "14px 16px", color: "#64748b", fontSize: "12px" }}>
                        {doc.created_at
                          ? new Date(doc.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>

                      {/* Actions: Strictly Ask, Download, Delete */}
                      <td style={{ padding: "14px 24px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                          {/* 1. Ask -> Directly opens chatbox /app with this folder/collection */}
                          <Link
                            href={`/app?collection=${encodeURIComponent(doc.collection || "default")}`}
                            title={`Ask questions specifically in folder "${doc.collection || "default"}"`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              color: "#4f46e5",
                              fontSize: "12px",
                              fontWeight: 600,
                              textDecoration: "none",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              background: "#eef2ff",
                              border: "1px solid #c7d2fe",
                              transition: "all 150ms ease",
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            Ask
                          </Link>

                          {/* 2. Download -> Streams original file */}
                          <a
                            href={getDocumentDownloadUrl(doc.id)}
                            download={doc.filename}
                            title={`Download ${doc.filename}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              color: "#334155",
                              fontSize: "12px",
                              fontWeight: 600,
                              textDecoration: "none",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              background: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              transition: "all 150ms ease",
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download
                          </a>

                          {/* 3. Delete -> Moves to macOS Dock Trash */}
                          <button
                            type="button"
                            onClick={() => handleMoveToTrash(doc)}
                            title="Move to Trash"
                            style={{
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              color: "#dc2626",
                              cursor: "pointer",
                              padding: "5px 10px",
                              borderRadius: "6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "12px",
                              fontWeight: 600,
                              transition: "all 150ms ease",
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* ── New Folder Creation Modal ── */}
        {isFolderModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
            onClick={() => setIsFolderModalOpen(false)}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                padding: "24px",
                width: "100%",
                maxWidth: "400px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
                border: "1px solid #e2e8f0",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Create New Folder
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: "16px" }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateFolder} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label
                    htmlFor="new-folder-name-input"
                    style={{ fontSize: "12px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "6px" }}
                  >
                    Folder / Collection Name
                  </label>
                  <input
                    id="new-folder-name-input"
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Policies, Analytics, Specifications..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setIsFolderModalOpen(false)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#475569",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#4f46e5",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)",
                    }}
                  >
                    Create Folder
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
