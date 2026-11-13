import { NextResponse } from "next/server";

export interface StoredEmail {
  id: string;
  sender_email: string;
  sender_name: string;
  recipient_emails: string[];
  cc_emails?: string[];
  bcc_emails?: string[];
  subject: string;
  body_text: string;
  body_html?: string;
  folder: string;
  is_read: boolean;
  is_starred: boolean;
  attachments: Array<{ name: string; size: number; type: string; url?: string }>;
  created_at: string;
}

// In-memory global store on Next.js server (shared across users on Vercel instances)
const globalEmails: StoredEmail[] = [
  {
    id: "mail-init-1",
    sender_email: "alex.chen@titan.com",
    sender_name: "Alex Chen (Lead AI Architect)",
    recipient_emails: ["srujeethvisinigiri@titan.com", "srujeethvisnigiri@gmail.com", "user2@titan.com"],
    subject: "Titan Knowledge Base & Neural RAG Index Ready",
    body_text:
      "Welcome to Titan Enterprise Workspace!\n\nThe vector embeddings and Qdrant collections have been indexed. You can now execute hybrid retrieval, generate grounded reports with inline citations, and start real-time video conferences or team chat.",
    body_html:
      "<p>Welcome to <strong>Titan Enterprise Workspace</strong>!</p><p>The vector embeddings and Qdrant collections have been indexed.</p>",
    folder: "inbox",
    is_read: false,
    is_starred: true,
    attachments: [{ name: "Titan_Architecture_V2.pdf", size: 142050, type: "application/pdf" }],
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "mail-init-2",
    sender_email: "finance@titan.com",
    sender_name: "Titan Executive Operations",
    recipient_emails: ["srujeethvisinigiri@titan.com", "srujeethvisnigiri@gmail.com", "user2@titan.com"],
    subject: "Q4 Performance & Financial Resource Report Attached",
    body_text:
      "Attached is the quarterly breakdown synthesized by our RAG model.\n\nReview the key KPIs, revenue trends, and hardware benchmarks.",
    body_html: "<p>Attached is the quarterly breakdown synthesized by our RAG model.</p>",
    folder: "inbox",
    is_read: true,
    is_starred: false,
    attachments: [{ name: "Q4_Financial_Summary.pdf", size: 98400, type: "application/pdf" }],
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get("folder") || "inbox";
  const userEmail = (searchParams.get("email") || "").toLowerCase().trim();
  const q = (searchParams.get("q") || "").toLowerCase().trim();

  let filtered = globalEmails.filter((m) => {
    if (folder === "starred") return m.is_starred;
    // For sent folder: must match sender
    if (folder === "sent") {
      if (!userEmail) return true;
      return m.sender_email.toLowerCase().trim() === userEmail;
    }
    // For inbox folder: must match recipient or be a received email
    if (folder === "inbox") {
      if (!userEmail) return true;
      const sender = m.sender_email.toLowerCase().trim();
      // If user is the sender, this email is in their sent folder, not inbox
      if (sender === userEmail) return false;
      return true;
    }
    return m.folder === folder;
  });

  if (q) {
    filtered = filtered.filter(
      (m) =>
        m.subject.toLowerCase().includes(q) ||
        m.body_text.toLowerCase().includes(q) ||
        m.sender_name.toLowerCase().includes(q) ||
        m.sender_email.toLowerCase().includes(q)
    );
  }

  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ items: filtered, total: filtered.length });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newEmail: StoredEmail = {
      id: body.id || `mail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender_email: body.sender_email || "user@titan.com",
      sender_name: body.sender_name || body.sender_email?.split("@")[0] || "Team Member",
      recipient_emails: body.recipient_emails || [],
      cc_emails: body.cc_emails || [],
      bcc_emails: body.bcc_emails || [],
      subject: body.subject || "(No Subject)",
      body_text: body.body_text || "",
      body_html: body.body_html || `<p>${(body.body_text || "").replace(/\n/g, "<br/>")}</p>`,
      folder: body.folder || (body.is_draft ? "drafts" : "sent"),
      is_read: false,
      is_starred: false,
      attachments: body.attachments || [],
      created_at: body.created_at || new Date().toISOString(),
    };

    // Prepend to server memory
    const existingIndex = globalEmails.findIndex((e) => e.id === newEmail.id);
    if (existingIndex >= 0) {
      globalEmails[existingIndex] = newEmail;
    } else {
      globalEmails.unshift(newEmail);
    }

    return NextResponse.json({ status: "ok", email: newEmail });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    const target = globalEmails.find((e) => e.id === id);
    if (target) {
      Object.assign(target, updates);
      return NextResponse.json({ status: "ok", email: target });
    }
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

