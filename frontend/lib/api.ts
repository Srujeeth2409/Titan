/**
 * Titan API client.
 *
 * All requests go through this module. Credentials are sent via
 * cookies automatically (credentials: "include").
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiError {
  code: string;
  message: string;
  trace_id: string;
}

export class TitanApiError extends Error {
  code: string;
  traceId: string;
  status: number;

  constructor(status: number, detail: ApiError) {
    super(detail.message);
    this.name = "TitanApiError";
    this.status = status;
    this.code = detail.code || `HTTP-${status}`;
    this.traceId = detail.trace_id || "";
  }
}

async function handleResponse(res: Response): Promise<any> {
  if (res.ok) {
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return res.json();
    }
    return res;
  }

  let detail: ApiError = {
    code: `HTTP-${res.status}`,
    message: res.statusText || "Request failed",
    trace_id: "",
  };

  try {
    const body = await res.json();
    if (body.detail) {
      detail = typeof body.detail === "string"
        ? { code: `HTTP-${res.status}`, message: body.detail, trace_id: "" }
        : body.detail;
    } else if (body.error) {
      detail = body.error;
    }
  } catch {
    // Response body wasn't JSON
  }

  throw new TitanApiError(res.status, detail);
}

async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  const opts: RequestInit = {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  };

  try {
    const res = await fetch(url, opts);
    return handleResponse(res);
  } catch (e) {
    if (e instanceof TitanApiError) throw e;
    throw new TitanApiError(0, {
      code: "TT-0000",
      message: "Network error — could not reach the API",
      trace_id: "",
    });
  }
}

// ---- Health ----

export async function getHealth() {
  const res = await fetch(`${API_URL}/v1/health`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

// ---- Documents ----

export async function getDocuments() {
  return apiFetch(`${API_URL}/v1/documents`);
}

export async function ingestDocument(file: File, collection: string = "default") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("collection", collection);

  const res = await fetch(`${API_URL}/v1/ingest`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  return handleResponse(res);
}

// ---- Ask ----

export async function ask(
  question: string,
  collection: string,
  mode: string
) {
  return apiFetch(`${API_URL}/v1/ask`, {
    method: "POST",
    body: JSON.stringify({
      question,
      collection,
      mode,
      filters: { source: null },
      options: { top_m: 6, return_chunks: true },
    }),
  });
}

/**
 * Streaming ask — returns the raw Response so the caller can read
 * the SSE stream via response.body.getReader().
 */
export async function askStream(
  question: string,
  collection: string,
  mode: string
): Promise<Response> {
  return fetch(`${API_URL}/v1/ask/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      collection,
      mode,
      filters: { source: null },
      options: { top_m: 6, return_chunks: true },
    }),
  });
}

export { API_URL };
