"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  apiGetEmails,
  apiGetMailCounts,
  apiSendEmail,
  apiUpdateEmail,
  apiDeleteEmail,
  apiGetEmployees,
  getStoredEmails,
  saveStoredEmails,
  EmailItem,
  EmployeeItem,
} from "@/lib/api";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  Inbox,
  Send,
  FileText,
  Archive,
  Trash2,
  Star,
  Search,
  PenSquare,
  Reply,
  ReplyAll,
  Forward,
  Paperclip,
  X,
  Loader2,
  CheckCircle2,
  Users,
} from "lucide-react";

/* ── Toast Component ── */
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-[300] flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <span>{message}</span>
      <button onClick={onClose} className="ml-1 text-slate-400 hover:text-white">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ── Employee Autocomplete ── */
function RecipientInput({
  value,
  onChange,
  placeholder,
  employees,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  employees: EmployeeItem[];
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorWord, setCursorWord] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    // Get the last comma-separated segment for filtering
    const parts = val.split(",");
    const last = (parts[parts.length - 1] || "").trim();
    setCursorWord(last);
    setShowSuggestions(last.length > 0);
  };

  const filtered = employees.filter((emp) => {
    if (!cursorWord) return false;
    const q = cursorWord.toLowerCase();
    return (
      emp.email.toLowerCase().includes(q) ||
      emp.full_name.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q)
    );
  });

  const handleSelect = (emp: EmployeeItem) => {
    const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
    // Replace the last partial entry with the selected email
    if (parts.length > 0 && cursorWord) {
      parts[parts.length - 1] = emp.email;
    } else {
      parts.push(emp.email);
    }
    onChange(parts.join(", ") + ", ");
    setShowSuggestions(false);
    setCursorWord("");
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => cursorWord.length > 0 && setShowSuggestions(true)}
        placeholder={placeholder}
        className="w-full text-xs outline-none bg-transparent text-slate-800"
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-80 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-[100]">
          {filtered.slice(0, 8).map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => handleSelect(emp)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-400 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {emp.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">{emp.full_name}</div>
                <div className="text-[11px] text-slate-400 truncate">
                  {emp.email} · {emp.department}
                </div>
              </div>
              <span
                className={`ml-auto w-2 h-2 rounded-full shrink-0 ${
                  emp.status === "online"
                    ? "bg-emerald-400"
                    : emp.status === "busy"
                    ? "bg-amber-400"
                    : "bg-slate-300"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MailPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [folder, setFolder] = useState("inbox");
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedMail, setSelectedMail] = useState<EmailItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Compose Modal State
  const [composeOpen, setComposeOpen] = useState(false);
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subjectInput, setSubjectInput] = useState("");
  const [bodyInput, setBodyInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  // Employee suggestions
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // File attachment ref
  const attachInputRef = useRef<HTMLInputElement>(null);

  // 1. Check for incoming draft / attachments forwarded from AI Chat or URL query
  useEffect(() => {
    // Check sessionStorage for document exported from Chat
    if (typeof window !== "undefined") {
      const pendingDraftStr = sessionStorage.getItem("titan_pending_mail_draft");
      if (pendingDraftStr) {
        try {
          const draft = JSON.parse(pendingDraftStr);
          sessionStorage.removeItem("titan_pending_mail_draft");

          if (draft.subject) setSubjectInput(draft.subject);
          if (draft.body) setBodyInput(draft.body);
          if (draft.attachment) {
            const blob = new Blob(
              [draft.attachment.content || "Attached RAG Document Generated by Titan"],
              { type: draft.attachment.type || "application/pdf" }
            );
            const file = new File([blob], draft.attachment.name || "Titan_Document.pdf", {
              type: draft.attachment.type || "application/pdf",
            });
            setAttachments([file]);
          }
          setComposeOpen(true);
          setToast("📎 Report attached from Chat! Select recipient to send.");
        } catch (e) {
          console.error("Failed to parse pending mail draft:", e);
        }
      }
    }

    // Check URL parameters
    const toParam = searchParams.get("to");
    const subjParam = searchParams.get("subject");
    const composeParam = searchParams.get("compose");
    if (toParam) setToInput(toParam);
    if (subjParam) setSubjectInput(subjParam);
    if (composeParam === "true" || toParam || subjParam) {
      setComposeOpen(true);
    }
  }, [searchParams]);

  // 2. Real-time Mail Delivery via Supabase (Cross-user, multi-device, zero collisions)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const myEmail = (user?.email || "").toLowerCase().trim();
    const mailChannel = supabase.channel("titan_corporate_mail");

    mailChannel
      .on("broadcast", { event: "new-email" }, ({ payload }) => {
        if (!payload || !payload.id) return;

        const recipients = (payload.recipient_emails || []).map((e: string) => e.toLowerCase().trim());
        const ccs = (payload.cc_emails || []).map((e: string) => e.toLowerCase().trim());
        const bccs = (payload.bcc_emails || []).map((e: string) => e.toLowerCase().trim());
        const sender = (payload.sender_email || "").toLowerCase().trim();

        // Check if current user is recipient (or demo fallback)
        const isRecipient = myEmail
          ? recipients.includes(myEmail) || ccs.includes(myEmail) || bccs.includes(myEmail)
          : true;
        const isSender = myEmail ? sender === myEmail : false;

        if (isRecipient && !isSender) {
          const receivedItem: EmailItem = {
            ...payload,
            folder: "inbox",
            is_read: false,
          };

          // Save to local cache
          const current = getStoredEmails();
          if (!current.some((m) => m.id === receivedItem.id)) {
            saveStoredEmails([receivedItem, ...current]);
          }

          // Prepend to current email list if on inbox
          setEmails((prev) => {
            if (prev.some((m) => m.id === receivedItem.id)) return prev;
            return [receivedItem, ...prev];
          });

          // Increment count badge
          setCounts((c) => ({
            ...c,
            inbox: (c.inbox || 0) + 1,
            unread_inbox: (c.unread_inbox || 0) + 1,
          }));

          setToast(`📬 New email from ${payload.sender_name}: "${payload.subject}"`);
        }
      })
      .subscribe();

    return () => {
      mailChannel.unsubscribe();
    };
  }, [user?.email]);

  // Load employees on mount for autocomplete
  useEffect(() => {
    apiGetEmployees()
      .then((res) => setEmployees(res.employees || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadMailData();
  }, [folder]);

  const loadMailData = async () => {
    setLoading(true);
    try {
      const [mailData, countData] = await Promise.all([
        apiGetEmails(folder, searchQuery),
        apiGetMailCounts(),
      ]);
      setEmails(mailData.items || []);
      setCounts(countData || {});
      if (mailData.items && mailData.items.length > 0 && !selectedMail) {
        setSelectedMail(mailData.items[0]);
      }
    } catch (err) {
      console.error("Failed to load mail:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMail = async (item: EmailItem) => {
    setSelectedMail(item);
    if (!item.is_read) {
      try {
        await apiUpdateEmail(item.id, { is_read: true });
        setEmails((prev) =>
          prev.map((e) => (e.id === item.id ? { ...e, is_read: true } : e))
        );
        setCounts((c) => ({
          ...c,
          unread_inbox: Math.max(0, (c.unread_inbox || 1) - 1),
        }));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleToggleStar = async (e: React.MouseEvent, item: EmailItem) => {
    e.stopPropagation();
    const newStar = !item.is_starred;
    try {
      await apiUpdateEmail(item.id, { is_starred: newStar });
      setEmails((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, is_starred: newStar } : m))
      );
      if (selectedMail?.id === item.id) {
        setSelectedMail({ ...selectedMail, is_starred: newStar });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (mailId: string) => {
    try {
      await apiDeleteEmail(mailId);
      setEmails((prev) => prev.filter((m) => m.id !== mailId));
      if (selectedMail?.id === mailId) {
        setSelectedMail(emails.find((m) => m.id !== mailId) || null);
      }
      loadMailData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async (asDraft = false) => {
    if (!asDraft && !toInput.trim()) {
      setToast("Please enter at least one recipient email");
      return;
    }

    setSending(true);
    try {
      const recipientList = toInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const ccList = ccInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const bccList = bccInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Convert file attachments to serializable metadata
      const attachMeta = attachments.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      }));

      await apiSendEmail({
        recipient_emails: recipientList,
        cc_emails: ccList,
        bcc_emails: bccList,
        subject: subjectInput || "(No Subject)",
        body_text: bodyInput,
        attachments: attachMeta,
        is_draft: asDraft,
      });

      const action = asDraft ? "Draft saved" : "Email sent";
      const recipientNames = recipientList
        .map((email) => {
          const emp = employees.find((e) => e.email === email);
          return emp ? emp.full_name : email;
        })
        .join(", ");

      setToast(
        asDraft
          ? `Draft saved successfully`
          : `Email sent to ${recipientNames}`
      );

      setComposeOpen(false);
      resetCompose();
      loadMailData();
    } catch (err) {
      console.error("Failed to send email:", err);
      setToast("Failed to send internal email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const resetCompose = () => {
    setToInput("");
    setCcInput("");
    setBccInput("");
    setSubjectInput("");
    setBodyInput("");
    setAttachments([]);
    setShowCc(false);
    setShowBcc(false);
  };

  const handleReply = (all = false) => {
    if (!selectedMail) return;
    setToInput(selectedMail.sender_email);
    if (all && selectedMail.recipient_emails) {
      setCcInput(selectedMail.recipient_emails.join(", "));
      setShowCc(true);
    }
    setSubjectInput(
      selectedMail.subject.startsWith("Re:") ? selectedMail.subject : `Re: ${selectedMail.subject}`
    );
    setBodyInput(`\n\n--- Original Message ---\nFrom: ${selectedMail.sender_name} <${selectedMail.sender_email}>\n${selectedMail.body_text}`);
    setComposeOpen(true);
  };

  const handleForward = () => {
    if (!selectedMail) return;
    setToInput("");
    setSubjectInput(`Fwd: ${selectedMail.subject}`);
    setBodyInput(`\n\n--- Forwarded Message ---\nFrom: ${selectedMail.sender_name} <${selectedMail.sender_email}>\nSubject: ${selectedMail.subject}\n\n${selectedMail.body_text}`);
    setComposeOpen(true);
  };

  const handleAttachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachments((prev) => [...prev, ...Array.from(files)]);
    }
    if (e.target) e.target.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const foldersList = [
    { id: "inbox", label: "Inbox", icon: Inbox, count: counts.unread_inbox },
    { id: "starred", label: "Starred", icon: Star, count: counts.starred },
    { id: "sent", label: "Sent", icon: Send, count: counts.sent },
    { id: "drafts", label: "Drafts", icon: FileText, count: counts.drafts },
    { id: "archive", label: "Archive", icon: Archive, count: counts.archive },
    { id: "trash", label: "Trash", icon: Trash2, count: counts.trash },
  ];

  return (
    <div className="max-w-7xl mx-auto w-full px-6 py-6 h-[calc(100vh-180px)] flex flex-col">
      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Top action bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Titan Mail</h1>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            Internal Corporate Mail
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadMailData()}
              placeholder="Search in emails..."
              className="pl-9 pr-4 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs rounded-xl border border-slate-200 outline-none w-56 transition-all"
            />
          </div>

          <button
            onClick={() => {
              resetCompose();
              setComposeOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
          >
            <PenSquare className="w-3.5 h-3.5" />
            <span>Compose</span>
          </button>
        </div>
      </div>

      {/* Main Mail Viewport: 3-column / split-view */}
      <div className="flex-1 flex overflow-hidden pt-4 gap-4">
        {/* Sidebar Folders */}
        <div className="w-48 shrink-0 flex flex-col space-y-1">
          {foldersList.map((f) => {
            const Icon = f.icon;
            const isActive = folder === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFolder(f.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{f.label}</span>
                </div>
                {!!f.count && f.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Email List Column */}
        <div className="w-80 shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider capitalize">
              {folder}
            </span>
            <span className="text-[11px] text-slate-400">{emails.length} messages</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : emails.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No messages in {folder}
              </div>
            ) : (
              emails.map((mail) => {
                const isSelected = selectedMail?.id === mail.id;
                return (
                  <div
                    key={mail.id}
                    onClick={() => handleSelectMail(mail)}
                    className={`p-3.5 cursor-pointer transition-colors flex flex-col gap-1 ${
                      isSelected
                        ? "bg-indigo-50/80 border-l-3 border-indigo-600"
                        : !mail.is_read
                        ? "bg-white hover:bg-slate-50/80 font-semibold"
                        : "bg-slate-50/30 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs truncate ${!mail.is_read ? "font-bold text-slate-900" : "font-medium text-slate-800"}`}>
                        {folder === "sent" ? (mail.recipient_emails?.[0] || "Recipient") : mail.sender_name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => handleToggleStar(e, mail)}
                          className={`p-0.5 rounded hover:bg-slate-200/60 transition-colors ${
                            mail.is_starred ? "text-amber-400 fill-amber-400" : "text-slate-300"
                          }`}
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(mail.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <p className={`text-xs truncate ${!mail.is_read ? "text-slate-900 font-semibold" : "text-slate-700"}`}>
                      {mail.subject || "(No Subject)"}
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {mail.body_text || "No text preview"}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Email Reading Pane */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
          {selectedMail ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header / Actions toolbar */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReply(false)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    <span>Reply</span>
                  </button>
                  <button
                    onClick={() => handleReply(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                  >
                    <ReplyAll className="w-3.5 h-3.5" />
                    <span>Reply All</span>
                  </button>
                  <button
                    onClick={handleForward}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                  >
                    <Forward className="w-3.5 h-3.5" />
                    <span>Forward</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(selectedMail.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Move to Trash"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message Details */}
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900 leading-snug">
                  {selectedMail.subject}
                </h2>
                <div className="flex items-center justify-between mt-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-400 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                      {selectedMail.sender_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {selectedMail.sender_name}{" "}
                        <span className="font-normal text-slate-400">&lt;{selectedMail.sender_email}&gt;</span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        To: {selectedMail.recipient_emails?.join(", ") || "Undisclosed recipients"}
                        {selectedMail.cc_emails && selectedMail.cc_emails.length > 0 && (
                          <span className="ml-2">CC: {selectedMail.cc_emails.join(", ")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(selectedMail.created_at).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              </div>

              {/* Attachments Section if any */}
              {selectedMail.attachments && selectedMail.attachments.length > 0 && (
                <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Attachments ({selectedMail.attachments.length}):</span>
                  </span>
                  {selectedMail.attachments.map((att, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-slate-200 text-xs text-slate-700"
                    >
                      <span className="font-medium">{att.name}</span>
                      <span className="text-slate-400 text-[10px]">({Math.round((att.size || 0) / 1024)} KB)</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Message Body */}
              <div className="flex-1 p-6 overflow-y-auto text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-normal">
                {selectedMail.body_text}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
              <Inbox className="w-10 h-10 text-slate-300 mb-2" />
              <p>Select an email to read</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Email Modal */}
      {composeOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">New Message</h3>
              <button onClick={() => setComposeOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 py-4 flex-1 overflow-y-auto">
              {/* To field with autocomplete */}
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs font-semibold text-slate-500 w-12 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  To:
                </span>
                <RecipientInput
                  value={toInput}
                  onChange={setToInput}
                  placeholder="Start typing name, email, or department..."
                  employees={employees}
                />
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  {!showCc && (
                    <button onClick={() => setShowCc(true)} className="hover:text-slate-600">
                      Cc
                    </button>
                  )}
                  {!showBcc && (
                    <button onClick={() => setShowBcc(true)} className="hover:text-slate-600">
                      Bcc
                    </button>
                  )}
                </div>
              </div>

              {showCc && (
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold text-slate-500 w-12">Cc:</span>
                  <RecipientInput
                    value={ccInput}
                    onChange={setCcInput}
                    placeholder="cc recipient..."
                    employees={employees}
                  />
                </div>
              )}

              {showBcc && (
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold text-slate-500 w-12">Bcc:</span>
                  <RecipientInput
                    value={bccInput}
                    onChange={setBccInput}
                    placeholder="bcc recipient..."
                    employees={employees}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs font-semibold text-slate-500 w-12">Subject:</span>
                <input
                  type="text"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  placeholder="Subject line..."
                  className="flex-1 text-xs outline-none bg-transparent text-slate-800 font-medium"
                />
              </div>

              <textarea
                value={bodyInput}
                onChange={(e) => setBodyInput(e.target.value)}
                placeholder="Write your email here..."
                className="w-full h-56 resize-none outline-none text-sm text-slate-800 leading-relaxed placeholder:text-slate-400"
              />

              {/* Attachments preview */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1 mr-1">
                    <Paperclip className="w-3 h-3" />
                    {attachments.length} file{attachments.length > 1 ? "s" : ""}:
                  </span>
                  {attachments.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700"
                    >
                      <span className="font-medium truncate max-w-[140px]">{file.name}</span>
                      <span className="text-slate-400 text-[10px]">
                        ({Math.round(file.size / 1024)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-slate-400 hover:text-rose-500 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSend(true)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  Save as Draft
                </button>

                {/* Attachment button */}
                <button
                  type="button"
                  onClick={() => attachInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Attach</span>
                </button>
                <input
                  ref={attachInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleAttachFiles}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => handleSend(false)}
                  disabled={sending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                >
                  {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{sending ? "Sending..." : "Send Message"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
