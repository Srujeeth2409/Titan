import { NextResponse } from "next/server";

export interface StoredChannel {
  id: string;
  name: string;
  channel_type: string;
  department?: string;
  description?: string;
  last_message?: {
    text: string;
    sender_name: string;
    created_at: string;
  } | null;
}

export interface StoredMessage {
  id: string;
  channel_id: string;
  user_id: string;
  sender_name: string;
  message_text: string;
  attachments: any[];
  reactions: Record<string, string[]>;
  reply_to_id?: string;
  created_at: string;
  is_me?: boolean;
}

const globalChannels: StoredChannel[] = [
  {
    id: "c-general",
    name: "general",
    channel_type: "public",
    department: "General",
    description: "Company-wide discussions, announcements, and team banter",
    last_message: {
      text: "Welcome to Titan workspace chat!",
      sender_name: "Titan Bot",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  },
  {
    id: "c-engineering",
    name: "engineering",
    channel_type: "public",
    department: "Engineering",
    description: "Architecture, pull requests, AI infrastructure, and system design",
    last_message: {
      text: "RAG embeddings index and WebRTC signaling upgraded to Supabase Realtime.",
      sender_name: "Srujeeth Visinigiri",
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
  },
  {
    id: "c-product",
    name: "product",
    channel_type: "public",
    department: "Product",
    description: "Product strategy, user research, roadmap milestones",
    last_message: {
      text: "Sprint 4 review scheduled for Friday.",
      sender_name: "Sarah Miller",
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
  },
  {
    id: "c-random",
    name: "random",
    channel_type: "public",
    department: "General",
    description: "Coffee breaks, office jokes, casual conversations",
    last_message: null,
  },
];

const globalMessages: Record<string, StoredMessage[]> = {
  "c-general": [
    {
      id: "seed-gen-1",
      channel_id: "c-general",
      user_id: "system",
      sender_name: "Titan Assistant",
      message_text: "Welcome to Titan Workspace Chat! You can chat with teammates across computers in real time.",
      attachments: [],
      reactions: { "🚀": ["system"], "👍": ["system"] },
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channel_id");

  if (channelId) {
    const msgs = globalMessages[channelId] || [];
    return NextResponse.json({ messages: msgs });
  }

  return NextResponse.json({ channels: globalChannels });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Channel creation
    if (body.type === "create_channel") {
      const newChan: StoredChannel = {
        id: `c-${body.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: body.name.toLowerCase().replace(/\s+/g, "-"),
        channel_type: body.channel_type || "public",
        department: body.department || "General",
        description: body.description || "",
        last_message: null,
      };
      if (!globalChannels.some((c) => c.id === newChan.id)) {
        globalChannels.push(newChan);
      }
      return NextResponse.json({ channel: newChan });
    }

    // Message creation
    const { channel_id, message_text, user_id, sender_name, reply_to_id } = body;
    const newMsg: StoredMessage = {
      id: body.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      channel_id,
      user_id: user_id || "user",
      sender_name: sender_name || "Team Member",
      message_text: message_text || "",
      attachments: body.attachments || [],
      reactions: {},
      reply_to_id,
      created_at: new Date().toISOString(),
    };

    if (!globalMessages[channel_id]) {
      globalMessages[channel_id] = [];
    }
    globalMessages[channel_id].push(newMsg);

    // Update channel last_message
    const chan = globalChannels.find((c) => c.id === channel_id);
    if (chan) {
      chan.last_message = {
        text: newMsg.message_text,
        sender_name: newMsg.sender_name,
        created_at: newMsg.created_at,
      };
    }

    return NextResponse.json({ status: "ok", message: newMsg });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

