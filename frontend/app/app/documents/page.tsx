"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getDocuments, ingestDocument, deleteDocument, TitanApiError } from "@/lib/api";

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
  const [isDragOver, setIsDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setUploadSuccess(null);

    try {
      const res = await ingestDocument(file, uploadCollection.trim() || "default");
      setUploadSuccess(`Successfully indexed "${file.name}" into "${res.collection}" (${res.chunks_created} chunks generated)`);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await fetchDocs();
    } catch (err: any) {
      if (err instanceof TitanApiError) {
        setError({ message: err.message, code: err.code, trace_id: err.traceId });
      } else {
        setError({ message: err.message || "File ingestion failed." });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}" and its indexed chunks?`)) {
      return;
    }

    setDeletingId(docId);
    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setUploadSuccess(`Deleted "${filename}" successfully.`);
    } catch (err: any) {
      if (err instanceof TitanApiError) {
        setError({ message: err.message, code: err.code, trace_id: err.traceId });
      } else {
        setError({ message: err.message || "Failed to delete document." });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileUpload(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFileUpload(file);
  };

  const statusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "indexed": return "#22c55e";
      case "processing":
      case "indexing": return "#60a5fa";
      case "queued": return "#f59e0b";
      case "failed": return "#ef4444";
      default: return "rgba(255, 255, 255, 0.4)";
    }
  };

  return (
    <div className="documents-page">
      {/* Page Header */}
      <div className="documents-page-header">
        <div>
          <h1 className="documents-page-title">Corpus Documents</h1>
          <p className="documents-page-subtitle">
            Upload and manage documents. Files are parsed, recursively chunked, embedded via BGE, and indexed into Qdrant & PostgreSQL.
          </p>
        </div>

        <div className="documents-actions">
          <div className="documents-collection-input">
            <label htmlFor="collection-name">Target Collection</label>
            <input
              id="collection-name"
              type="text"
              placeholder="default"
              value={uploadCollection}
              onChange={(e) => setUploadCollection(e.target.value)}
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.md,.txt,.csv,.json,.log"
            style={{ display: "none" }}
            id="file-upload-input"
            onChange={handleInputChange}
          />
          <button
            type="button"
            className="documents-upload-btn"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {isUploading ? "Chunking & Indexing..." : "Upload Document"}
          </button>
        </div>
      </div>

      {/* Status Banners */}
      {uploadSuccess && (
        <div className="documents-banner success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div style={{ flex: 1 }}>{uploadSuccess}</div>
          <button
            onClick={() => setUploadSuccess(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="documents-banner error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div>
              <span>{error.message}</span>
              {error.code && (
                <code className="documents-error-code">
                  {error.code}{error.trace_id ? ` • ${error.trace_id}` : ""}
                </code>
              )}
            </div>
            {error.code === "TT-4010" && (
              <a
                href="/login?next=/app/documents"
                style={{
                  background: "#ffffff",
                  color: "#000000",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  textDecoration: "none",
                  marginLeft: "12px",
                  whiteSpace: "nowrap",
                }}
              >
                Sign In
              </a>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="documents-loading">
          <div className="spinner" />
          <span>Connecting to Titan document repository...</span>
        </div>
      ) : documents.length === 0 ? (
        <div
          className={`documents-drop-zone ${isDragOver ? "drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="documents-drop-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h3>Drop files here to index</h3>
          <p>Supports PDF, DOCX, Markdown (.md), TXT, CSV, JSON, and Log files (.log)</p>
          <span className="documents-drop-hint">or click to browse your local filesystem</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Active Documents Table */}
          <div
            className={`documents-table-container ${isDragOver ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <table className="documents-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Format</th>
                  <th>Collection</th>
                  <th>Status</th>
                  <th>Pages</th>
                  <th>Chunks</th>
                  <th>Uploaded</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="documents-filename">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>{doc.filename}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
                        {doc.source_type}
                      </span>
                    </td>
                    <td>
                      <span className="documents-collection-badge">
                        {doc.collection || "default"}
                      </span>
                    </td>
                    <td>
                      <span className="documents-status" style={{ color: statusColor(doc.status) }}>
                        <span className="documents-status-dot" style={{ background: statusColor(doc.status) }} />
                        {doc.status}
                      </span>
                    </td>
                    <td className="documents-num">{doc.page_count ?? "1"}</td>
                    <td className="documents-num">{doc.chunk_count ?? "—"}</td>
                    <td className="documents-date">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                        <Link
                          href={`/app`}
                          title="Ask questions with this corpus"
                          style={{
                            color: "#60a5fa",
                            fontSize: "12px",
                            textDecoration: "none",
                            fontWeight: 500,
                          }}
                        >
                          Ask →
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.id, doc.filename)}
                          disabled={deletingId === doc.id}
                          title="Delete document and vector index"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "rgba(239, 68, 68, 0.7)",
                            cursor: deletingId === doc.id ? "not-allowed" : "pointer",
                            padding: "4px 6px",
                            borderRadius: "4px",
                            display: "inline-flex",
                            alignItems: "center",
                            transition: "color 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(239, 68, 68, 0.7)")}
                        >
                          {deletingId === doc.id ? (
                            <span style={{ fontSize: "11px" }}>...</span>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick upload drop bar */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "16px",
              borderRadius: "12px",
              border: "1px dashed rgba(255, 255, 255, 0.15)",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              textAlign: "center",
              cursor: "pointer",
              fontSize: "13px",
              color: "rgba(255, 255, 255, 0.6)",
              transition: "border-color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.35)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)")}
          >
            <span>+ Click or drag another file here to index into <strong>&quot;{uploadCollection || "default"}&quot;</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
