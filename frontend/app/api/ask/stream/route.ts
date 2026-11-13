/**
 * Cloud-side SSE proxy for /v1/ask/stream
 *
 * When deployed on Vercel (no local backend), this route:
 *  1. Tries to forward to the backend at INTERNAL_API_URL (if set, e.g. via tunnel)
 *  2. Falls back to Groq llama-3.3-70b-versatile (free tier) for a streaming response
 *  3. If no Groq key, falls back to a helpful static explanation
 *
 * On local dev the client calls the Docker backend directly, so this route
 * is only used in cloud deployments.
 */

import { NextRequest } from "next/server";

export const runtime = "edge";
export const maxDuration = 60;

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || ""; // e.g. ngrok tunnel

function makeSSEChunk(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function makeStream(
  gen: AsyncGenerator<string, void, unknown>
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      for await (const chunk of gen) {
        controller.enqueue(enc.encode(chunk));
      }
      controller.close();
    },
  });
}

async function* groqStream(
  question: string,
  mode: string
): AsyncGenerator<string, void, unknown> {
  // Send initial status events like the real backend does
  yield makeSSEChunk({ type: "status", status: "query_analysis" });
  yield makeSSEChunk({ type: "status", status: "embedding_generation" });
  yield makeSSEChunk({ type: "status", status: "retrieval" });

  const systemPrompt = `You are Titan, an enterprise RAG assistant. Answer questions clearly and concisely. 
If generating a report, use Markdown with headers, tables, and bullet points. 
Mode: ${mode}`;

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      stream: true,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!groqRes.ok || !groqRes.body) {
    const err = await groqRes.text();
    yield makeSSEChunk({
      type: "error",
      error: `Groq API error: ${groqRes.status} ${err.slice(0, 200)}`,
    });
    return;
  }

  const reader = groqRes.body.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  let fullAnswer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") continue;
      try {
        const parsed = JSON.parse(raw);
        const delta = parsed?.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          fullAnswer += delta;
          yield makeSSEChunk({ type: "token", token: delta });
        }
      } catch {
        // skip malformed
      }
    }
  }

  // Final answer event
  yield makeSSEChunk({
    type: "answer",
    answer: fullAnswer,
    citations: [],
    chunks: [],
  });
  yield makeSSEChunk({ type: "done" });
}

async function* fallbackStream(
  question: string
): AsyncGenerator<string, void, unknown> {
  yield makeSSEChunk({ type: "status", status: "query_analysis" });
  yield makeSSEChunk({ type: "status", status: "retrieval" });

  const msg =
    `**Titan AI — Cloud Mode**\n\n` +
    `The local AI backend (Ollama/Docker) is not reachable from this cloud deployment.\n\n` +
    `**Your question:** _${question}_\n\n` +
    `To enable full AI responses on the deployed site, either:\n` +
    `1. Add a \`GROQ_API_KEY\` environment variable in Vercel (get a free key at https://console.groq.com)\n` +
    `2. Run the backend locally and expose it via a tunnel (ngrok, Cloudflare Tunnel)\n\n` +
    `The local version of Titan with Ollama is fully functional.`;

  for (const word of msg.split(" ")) {
    yield makeSSEChunk({ type: "token", token: word + " " });
    await new Promise((r) => setTimeout(r, 15));
  }

  yield makeSSEChunk({ type: "answer", answer: msg, citations: [], chunks: [] });
  yield makeSSEChunk({ type: "done" });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { question = "", collection = "default", mode = "hybrid" } = body;

  // --- Option 1: Proxy to internal backend tunnel ---
  if (INTERNAL_API_URL) {
    try {
      const upstream = await fetch(`${INTERNAL_API_URL}/v1/ask/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      }
    } catch {
      // fall through to Groq
    }
  }

  // --- Option 2: Groq streaming ---
  const gen =
    GROQ_API_KEY ? groqStream(question, mode) : fallbackStream(question);

  return new Response(makeStream(gen), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
