"use client";

import { useEffect, useState, useRef } from "react";
import { getDocuments, ingestDocument, TitanApiError } from "@/lib/api";

interface DocumentItem {
  id: string;
  filename: string;
  source_type: string;
  collection: string;
  status: string;
  page_count?: number;
  chunk_count?: number;
  created_at?: string;
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
      const res = await ingestDocument(file, uploadCollection || "default");
      setUploadSuccess(`Successfully indexed "${file.name}" (${res.chunks_created} chunks generated)`);
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

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "indexed": return "var(--color-success)";
      case "processing": return "var(--color-accent)";
      case "queued": return "var(--color-warning)";
      case "failed": return "var(--color-error)";
      default: return "var(--color-text-muted)";
    }
  };

  return (
    <div className="documents-page">
      {/* Page Header */}
      <div className="documents-page-header">
        <div>
          <h1 className="documents-page-title">Documents</h1>
          <p className="documents-page-subtitle">
            Upload and manage your document corpus. All files are chunked, embedded, and indexed for retrieval.
          </p>
        </div>

        <div className="documents-actions">
          <div className="documents-collection-input">
            <label htmlFor="collection-name">Collection</label>
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
            accept=".pdf,.docx,.md,.txt,.csv,.json"
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
            {isUploading ? "Indexing..." : "Upload"}
          </button>
        </div>
      </div>

      {/* Status Banners */}
      {uploadSuccess && (
        <div className="documents-banner success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {uploadSuccess}
        </div>
      )}

      {error && (
        <div className="documents-banner error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <div>
            <span>{error.message}</span>
            {error.code && (
              <code className="documents-error-code">
                {error.code}{error.trace_id ? ` • ${error.trace_id}` : ""}
              </code>
            )}
          </div>
        </div>
      )}

      {/* Drop zone / Content */}
      {loading ? (
        <div className="documents-loading">
          <div className="spinner" />
          <span>Loading document index...</span>
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
          <p>Supports PDF, DOCX, Markdown, TXT, CSV, and JSON</p>
          <span className="documents-drop-hint">or click to browse</span>
        </div>
      ) : (
        <div
          className={`documents-table-container ${isDragOver ? "drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <table className="documents-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Collection</th>
                <th>Status</th>
                <th>Pages</th>
                <th>Chunks</th>
                <th>Indexed</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="documents-filename">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    {doc.filename}
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
                  <td className="documents-num">{doc.page_count ?? "—"}</td>
                  <td className="documents-num">{doc.chunk_count ?? "—"}</td>
                  <td className="documents-date">
                    {doc.created_at ? new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
