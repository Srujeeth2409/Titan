/**
 * Titan API client.
 *
 * All requests go through this module. Credentials are sent via
 * both Authorization: Bearer <token> headers and cookies (credentials: "include").
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "titan_access_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearStoredToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

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
  const token = getStoredToken();
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const opts: RequestInit = {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
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

// ---- Authentication ----

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  department?: string;
  role?: string;
  title?: string;
  phone?: string;
  avatar_url?: string;
  status?: string;
  status_message?: string;
  access_token?: string;
  token_type?: string;
}

export async function apiLogin(email: string, password: string): Promise<AuthUser> {
  const data = await apiFetch(`${API_URL}/v1/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data.access_token) {
    setStoredToken(data.access_token);
  }
  return data;
}

export async function apiSignup(email: string, password: string): Promise<AuthUser> {
  const data = await apiFetch(`${API_URL}/v1/auth/signup`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data.access_token) {
    setStoredToken(data.access_token);
  }
  return data;
}

export async function apiLogout(): Promise<void> {
  try {
    await apiFetch(`${API_URL}/v1/auth/logout`, {
      method: "POST",
    });
  } finally {
    clearStoredToken();
  }
}

export async function apiGetMe(): Promise<AuthUser> {
  return apiFetch(`${API_URL}/v1/auth/me`);
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

export async function getDocuments(): Promise<{ total: number; documents: DocumentItem[] }> {
  return apiFetch(`${API_URL}/v1/documents`);
}

export async function ingestDocument(file: File, collection: string = "default") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("collection", collection);

  const token = getStoredToken();
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(`${API_URL}/v1/ingest`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders,
    body: formData,
  });

  return handleResponse(res);
}

export async function deleteDocument(documentId: string) {
  return apiFetch(`${API_URL}/v1/documents/${documentId}`, {
    method: "DELETE",
  });
}

export function getDocumentDownloadUrl(documentId: string): string {
  return `${API_URL}/v1/documents/${documentId}/download`;
}

export async function moveDocument(documentId: string, collection: string) {
  return apiFetch(`${API_URL}/v1/documents/${documentId}/move`, {
    method: "PATCH",
    body: JSON.stringify({ collection }),
  });
}

export async function copyDocument(documentId: string, collection: string) {
  return apiFetch(`${API_URL}/v1/documents/${documentId}/copy`, {
    method: "POST",
    body: JSON.stringify({ collection }),
  });
}

// ---- Ask ----

export async function ask(
  question: string,
  collection: string,
  mode: string,
  provider?: string,
  model?: string
) {
  return apiFetch(`${API_URL}/v1/ask`, {
    method: "POST",
    body: JSON.stringify({
      question,
      collection,
      mode,
      provider: provider || null,
      model: model || null,
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
  mode: string,
  provider?: string,
  model?: string,
  effort?: string
): Promise<Response> {
  const token = getStoredToken();
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  return fetch(`${API_URL}/v1/ask/stream`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      question,
      collection,
      mode,
      provider: provider || null,
      model: model || null,
      effort: effort || "Medium",
      filters: { source: null },
      options: { top_m: 6, return_chunks: true },
    }),
  });
}

export { API_URL };

// ============================================================================
// Enterprise Workspace API Methods
// ============================================================================

// ---- Mail ----

export interface EmailItem {
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

export async function apiGetEmails(folder = "inbox", q = ""): Promise<{ items: EmailItem[]; total: number }> {
  const query = new URLSearchParams({ folder });
  if (q) query.set("q", q);
  return apiFetch(`${API_URL}/v1/mail?${query.toString()}`);
}

export async function apiGetMailCounts(): Promise<Record<string, number>> {
  return apiFetch(`${API_URL}/v1/mail/counts`);
}

export async function apiGetEmail(id: string): Promise<EmailItem> {
  return apiFetch(`${API_URL}/v1/mail/${id}`);
}

export async function apiSendEmail(payload: {
  recipient_emails: string[];
  cc_emails?: string[];
  bcc_emails?: string[];
  subject: string;
  body_text: string;
  body_html?: string;
  attachments?: any[];
  is_draft?: boolean;
  draft_id?: string;
}) {
  return apiFetch(`${API_URL}/v1/mail/send`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateEmail(id: string, payload: { folder?: string; is_read?: boolean; is_starred?: boolean }) {
  return apiFetch(`${API_URL}/v1/mail/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteEmail(id: string, permanent = false) {
  return apiFetch(`${API_URL}/v1/mail/${id}?permanent=${permanent}`, {
    method: "DELETE",
  });
}

// ---- Chat ----

export interface ChatChannelItem {
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

export interface ChatMessageItem {
  id: string;
  channel_id: string;
  user_id: string;
  sender_name: string;
  message_text: string;
  attachments: any[];
  reactions: Record<string, string[]>;
  reply_to_id?: string;
  created_at: string;
  is_me: boolean;
}

export async function apiGetChannels(): Promise<{ channels: ChatChannelItem[] }> {
  return apiFetch(`${API_URL}/v1/chat/channels`);
}

export async function apiCreateChannel(payload: {
  name: string;
  channel_type?: string;
  department?: string;
  description?: string;
}) {
  return apiFetch(`${API_URL}/v1/chat/channels`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiGetChannelMessages(channelId: string): Promise<{ messages: ChatMessageItem[] }> {
  return apiFetch(`${API_URL}/v1/chat/channels/${channelId}/messages`);
}

export async function apiSendMessage(
  channelId: string,
  payload: { message_text: string; attachments?: any[]; reply_to_id?: string }
): Promise<{ status: string; message: ChatMessageItem }> {
  return apiFetch(`${API_URL}/v1/chat/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiToggleReaction(messageId: string, emoji: string) {
  return apiFetch(`${API_URL}/v1/chat/messages/${messageId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

// ---- Calendar ----

export interface CalendarEventItem {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  location?: string;
  recurrence: string;
  department?: string;
  attendees: string[];
  meeting_link?: string;
  is_owner: boolean;
}

export async function apiGetCalendarEvents(start?: string, end?: string): Promise<{ events: CalendarEventItem[] }> {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return apiFetch(`${API_URL}/v1/calendar/events?${params.toString()}`);
}

export async function apiCreateCalendarEvent(payload: {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  is_all_day?: boolean;
  location?: string;
  recurrence?: string;
  attendees?: string[];
  meeting_link?: string;
}) {
  return apiFetch(`${API_URL}/v1/calendar/events`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiCheckCalendarConflicts(payload: {
  start_time: string;
  end_time: string;
  attendees?: string[];
  exclude_event_id?: string;
}) {
  return apiFetch(`${API_URL}/v1/calendar/check-conflicts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteCalendarEvent(id: string) {
  return apiFetch(`${API_URL}/v1/calendar/events/${id}`, {
    method: "DELETE",
  });
}

// ---- Meetings ----

export interface MeetingItem {
  id: string;
  room_code: string;
  title: string;
  host_id: string;
  host_name: string;
  department?: string;
  is_active: boolean;
  notes?: string;
  action_items?: Array<{ title: string; assignee_name?: string; priority?: string }>;
  scheduled_start?: string;
  scheduled_end?: string;
  created_at: string;
  action_items_count?: number;
}

export async function apiGetMeetings(): Promise<{ meetings: MeetingItem[] }> {
  return apiFetch(`${API_URL}/v1/meetings`);
}

export async function apiCreateMeeting(payload: {
  title: string;
  department?: string;
  scheduled_start?: string;
  scheduled_end?: string;
}) {
  return apiFetch(`${API_URL}/v1/meetings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiGetMeeting(roomCode: string): Promise<MeetingItem> {
  return apiFetch(`${API_URL}/v1/meetings/${roomCode}`);
}

export async function apiUpdateMeeting(
  roomCode: string,
  payload: { notes?: string; action_items?: any[]; is_active?: boolean }
) {
  return apiFetch(`${API_URL}/v1/meetings/${roomCode}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiConvertMeetingActions(roomCode: string, items: any[]) {
  return apiFetch(`${API_URL}/v1/meetings/${roomCode}/convert-actions`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export interface MeetingSignalItem {
  id: string;
  peer_id: string;
  sender_name: string;
  signal_type: "join" | "offer" | "answer" | "candidate" | "leave" | "chat";
  target_peer_id?: string | null;
  data: any;
  timestamp: number;
}

export async function apiSendMeetingSignal(
  roomCode: string,
  payload: {
    peer_id: string;
    sender_name: string;
    signal_type: string;
    target_peer_id?: string | null;
    data?: any;
  }
) {
  return apiFetch(`${API_URL}/v1/meetings/${roomCode}/signal`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiPollMeetingSignals(
  roomCode: string,
  peerId: string,
  since: number = 0
): Promise<{
  signals: MeetingSignalItem[];
  active_peers: { peer_id: string; sender_name: string; last_seen: number }[];
  timestamp: number;
}> {
  return apiFetch(
    `${API_URL}/v1/meetings/${roomCode}/signals?peer_id=${encodeURIComponent(peerId)}&since=${since}`
  );
}

// ---- Files ----

export interface WorkspaceFolder {
  name: string;
  path: string;
  file_count: number;
  size_bytes: number;
}

export interface WorkspaceFileItem {
  id: string;
  name: string;
  folder_path: string;
  size_bytes: number;
  mime_type: string;
  department: string;
  access_level: string;
  version: number;
  summary?: string;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
}

export async function apiGetFiles(
  folderPath = "/",
  q = ""
): Promise<{ current_folder: string; folders: WorkspaceFolder[]; files: WorkspaceFileItem[] }> {
  const params = new URLSearchParams({ folder_path: folderPath });
  if (q) params.set("q", q);
  return apiFetch(`${API_URL}/v1/files?${params.toString()}`);
}

export async function apiUploadWorkspaceFile(file: File, folderPath = "/", accessLevel = "internal") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder_path", folderPath);
  formData.append("access_level", accessLevel);

  const token = getStoredToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${API_URL}/v1/files/upload`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders,
    body: formData,
  });

  return handleResponse(res);
}

export async function apiSummarizeFile(fileId: string): Promise<{ status: string; summary: string }> {
  return apiFetch(`${API_URL}/v1/files/${fileId}/summarize`, {
    method: "POST",
  });
}

export async function apiDeleteWorkspaceFile(fileId: string) {
  return apiFetch(`${API_URL}/v1/files/${fileId}`, {
    method: "DELETE",
  });
}

export function getFileDownloadUrl(fileId: string): string {
  return `${API_URL}/v1/files/${fileId}/download`;
}

// ---- Tasks ----

export interface TaskItemData {
  id: string;
  title: string;
  description?: string;
  creator_id: string;
  assignee_id?: string;
  assignee_name?: string;
  department: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "in_review" | "completed";
  due_date?: string;
  source_ref?: string;
  created_at: string;
  is_mine: boolean;
}

export async function apiGetTasks(
  view = "all",
  statusFilter = "",
  department = ""
): Promise<{ tasks: TaskItemData[] }> {
  const params = new URLSearchParams({ view });
  if (statusFilter) params.set("status_filter", statusFilter);
  if (department) params.set("department", department);
  return apiFetch(`${API_URL}/v1/tasks?${params.toString()}`);
}

export async function apiCreateTask(payload: {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  department?: string;
  assignee_name?: string;
  due_date?: string;
  source_ref?: string;
}) {
  return apiFetch(`${API_URL}/v1/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateTask(id: string, payload: Partial<TaskItemData>) {
  return apiFetch(`${API_URL}/v1/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteTask(id: string) {
  return apiFetch(`${API_URL}/v1/tasks/${id}`, {
    method: "DELETE",
  });
}

// ---- Directory ----

export interface EmployeeItem {
  id: string;
  email: string;
  full_name: string;
  department: string;
  role: string;
  title: string;
  phone: string;
  status: "online" | "busy" | "away" | "offline";
  status_message?: string;
  avatar_url?: string;
  is_me: boolean;
}

export async function apiGetEmployees(department = "", q = ""): Promise<{ employees: EmployeeItem[] }> {
  const params = new URLSearchParams();
  if (department) params.set("department", department);
  if (q) params.set("q", q);
  return apiFetch(`${API_URL}/v1/directory?${params.toString()}`);
}

export async function apiGetDepartments(): Promise<{ departments: Array<{ name: string; count: number }> }> {
  return apiFetch(`${API_URL}/v1/directory/departments`);
}

export async function apiUpdateProfile(payload: {
  full_name?: string;
  title?: string;
  department?: string;
  phone?: string;
  status?: string;
  status_message?: string;
}) {
  return apiFetch(`${API_URL}/v1/directory/me`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ---- Notes ----

export interface QuickNoteItem {
  id: string;
  title: string;
  content: string;
  color: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export async function apiGetNotes(): Promise<{ notes: QuickNoteItem[] }> {
  return apiFetch(`${API_URL}/v1/notes`);
}

export async function apiCreateNote(payload: {
  title?: string;
  content?: string;
  color?: string;
  is_pinned?: boolean;
}) {
  return apiFetch(`${API_URL}/v1/notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateNote(id: string, payload: Partial<QuickNoteItem>) {
  return apiFetch(`${API_URL}/v1/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteNote(id: string) {
  return apiFetch(`${API_URL}/v1/notes/${id}`, {
    method: "DELETE",
  });
}

// ---- Announcements ----

export interface AnnouncementItem {
  id: string;
  author_name: string;
  title: string;
  content: string;
  department: string;
  priority: "normal" | "important" | "urgent";
  created_at: string;
}

export async function apiGetAnnouncements(): Promise<{ announcements: AnnouncementItem[] }> {
  return apiFetch(`${API_URL}/v1/announcements`);
}

export async function apiCreateAnnouncement(payload: {
  title: string;
  content: string;
  department?: string;
  priority?: string;
}) {
  return apiFetch(`${API_URL}/v1/announcements`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---- Notifications ----

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export async function apiGetNotifications(): Promise<{ unread_count: number; notifications: NotificationItem[] }> {
  return apiFetch(`${API_URL}/v1/notifications`);
}

export async function apiMarkNotificationRead(id: string) {
  return apiFetch(`${API_URL}/v1/notifications/${id}/read`, {
    method: "POST",
  });
}

export async function apiMarkAllNotificationsRead() {
  return apiFetch(`${API_URL}/v1/notifications/read-all`, {
    method: "POST",
  });
}

// ---- Global Search ----

export interface GlobalSearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  type: "file" | "mail" | "task" | "chat" | "employee" | "document";
  link: string;
}

export async function apiGlobalSearch(query: string): Promise<{
  query: string;
  total_hits: number;
  results: Record<string, GlobalSearchResultItem[]>;
}> {
  return apiFetch(`${API_URL}/v1/search/global?q=${encodeURIComponent(query)}`);
}

