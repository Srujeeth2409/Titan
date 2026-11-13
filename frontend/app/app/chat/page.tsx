"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  apiGetChannels,
  apiCreateChannel,
  apiGetChannelMessages,
  apiSendMessage,
  apiToggleReaction,
  apiGetEmployees,
  saveStoredChatMessages,
  getStoredChatMessages,
  ChatChannelItem,
  ChatMessageItem,
  EmployeeItem,
} from "@/lib/api";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  Hash,
  Users,
  Plus,
  Send,
  Smile,
  Paperclip,
  Search,
  MessageSquare,
  X,
  Loader2,
  Reply,
  Radio,
} from "lucide-react";

const EMOJIS = ["👍", "❤️", "🚀", "🎉", "🔥", "👀"];

export default function ChatPage() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<ChatChannelItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [messageText, setMessageText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessageItem | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // New Channel Modal
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [newChannelDept, setNewChannelDept] = useState("General");
  const [creatingChannel, setCreatingChannel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Realtime Supabase Channel Subscription for Live Chat
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const chatChannel = supabase.channel("titan_workspace_chat");

    chatChannel
      .on("broadcast", { event: "new-message" }, ({ payload }) => {
        if (!payload || !payload.id) return;
        const incoming: ChatMessageItem = payload;
        const myId = user?.id;
        const isMe = Boolean(myId && incoming.user_id === myId);

        // Save to local cache for persistence
        const existing = getStoredChatMessages(incoming.channel_id);
        if (!existing.some((m) => m.id === incoming.id)) {
          saveStoredChatMessages(incoming.channel_id, [...existing, { ...incoming, is_me: isMe }]);
        }

        // If currently viewing this channel, append message live
        if (incoming.channel_id === activeChannelId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, { ...incoming, is_me: isMe }];
          });
        }

        // Update channel last_message preview
        setChannels((prev) =>
          prev.map((c) =>
            c.id === incoming.channel_id
              ? {
                  ...c,
                  last_message: {
                    text: incoming.message_text,
                    sender_name: incoming.sender_name,
                    created_at: incoming.created_at,
                  },
                }
              : c
          )
        );
      })
      .on("broadcast", { event: "new-channel" }, ({ payload }) => {
        if (!payload || !payload.id) return;
        setChannels((prev) => {
          if (prev.some((c) => c.id === payload.id)) return prev;
          return [...prev, payload];
        });
      })
      .on("broadcast", { event: "new-reaction" }, ({ payload }) => {
        if (!payload || !payload.messageId) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== payload.messageId) return m;
            const currentUsers = m.reactions[payload.emoji] || [];
            const hasReacted = currentUsers.includes(payload.userId);
            const nextUsers = hasReacted
              ? currentUsers.filter((u) => u !== payload.userId)
              : [...currentUsers, payload.userId];
            const nextReactions = { ...m.reactions };
            if (nextUsers.length > 0) {
              nextReactions[payload.emoji] = nextUsers;
            } else {
              delete nextReactions[payload.emoji];
            }
            return { ...m, reactions: nextReactions };
          })
        );
      })
      .subscribe();

    return () => {
      chatChannel.unsubscribe();
    };
  }, [activeChannelId, user?.id]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeChannelId) {
      loadMessages(activeChannelId);
      const interval = setInterval(() => loadMessages(activeChannelId, true), 3000);
      return () => clearInterval(interval);
    }
  }, [activeChannelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadInitialData = async () => {
    setLoadingChannels(true);
    try {
      const [cData, eData] = await Promise.all([
        apiGetChannels(),
        apiGetEmployees(),
      ]);
      setChannels(cData.channels || []);
      setEmployees(eData.employees || []);
      if (cData.channels && cData.channels.length > 0 && !activeChannelId) {
        setActiveChannelId(cData.channels[0].id);
      }
    } catch (err) {
      console.error("Failed to load chat channels:", err);
    } finally {
      setLoadingChannels(false);
    }
  };

  const loadMessages = async (channelId: string, background = false) => {
    if (!background) setLoadingMessages(true);
    try {
      const data = await apiGetChannelMessages(channelId);
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      if (!background) setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeChannelId) return;

    const textToSend = messageText.trim();
    setMessageText("");
    const replyId = replyTo?.id;
    setReplyTo(null);

    setSending(true);
    try {
      const res = await apiSendMessage(activeChannelId, {
        message_text: textToSend,
        reply_to_id: replyId,
      });
      if (res.message) {
        setMessages((prev) => [...prev, res.message]);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessageText(textToSend); // restore on error
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await apiToggleReaction(messageId, emoji);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: res.reactions } : m))
      );
    } catch (err) {
      console.error("Failed to toggle reaction:", err);
    }
  };

  const handleCreateChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    setCreatingChannel(true);
    try {
      const res = await apiCreateChannel({
        name: newChannelName.trim(),
        department: newChannelDept,
        description: newChannelDesc,
      });
      if (res.channel) {
        setChannels((prev) => [...prev, res.channel]);
        setActiveChannelId(res.channel.id);
        setNewChannelOpen(false);
        setNewChannelName("");
        setNewChannelDesc("");
      }
    } catch (err) {
      console.error("Failed to create channel:", err);
    } finally {
      setCreatingChannel(false);
    }
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <div className="max-w-7xl mx-auto w-full px-6 py-6 h-[calc(100vh-180px)] flex flex-col">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Titan Chat & Messages</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Internal team conversations, department channels, and peer messaging
          </p>
        </div>

        <button
          onClick={() => setNewChannelOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Channel</span>
        </button>
      </div>

      {/* Main Chat Interface: Sidebar + Message Viewport */}
      <div className="flex-1 flex overflow-hidden pt-4 gap-4">
        {/* Left Sidebar: Channels & Direct Messages */}
        <div className="w-64 shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Channels</span>
            <button
              onClick={() => setNewChannelOpen(true)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-200/60"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {/* Channels List */}
            <div className="space-y-0.5">
              {channels.map((ch) => {
                const isActive = ch.id === activeChannelId;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannelId(ch.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Hash className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                    <span className="truncate flex-1 text-left">{ch.name}</span>
                    {ch.department && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        {ch.department}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Direct Message Team Members */}
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Team Members</span>
                <span className="text-[10px] font-normal">{employees.length}</span>
              </div>
              <div className="space-y-0.5 mt-1">
                {employees.slice(0, 8).map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="relative">
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                        {emp.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-white ${
                          emp.status === "online"
                            ? "bg-emerald-500"
                            : emp.status === "busy"
                            ? "bg-rose-500"
                            : "bg-slate-400"
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800 truncate">{emp.full_name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{emp.department}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Message Viewport */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
          {activeChannel ? (
            <>
              {/* Channel Header */}
              <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900">{activeChannel.name}</h2>
                      {activeChannel.department && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-semibold border border-indigo-100">
                          {activeChannel.department}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeChannel.description || "General department discussion and collaboration"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                  <span>Air-gapped Local Mesh</span>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {loadingMessages ? (
                  <div className="py-16 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p>No messages in #{activeChannel.name} yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">Be the first to start the discussion!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 group ${msg.is_me ? "flex-row-reverse" : "flex-row"}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                          {msg.sender_name.charAt(0).toUpperCase()}
                        </div>

                        <div className={`max-w-[75%] ${msg.is_me ? "items-end" : "items-start"} flex flex-col`}>
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <span className="text-xs font-semibold text-slate-800">{msg.sender_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          <div
                            className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                              msg.is_me
                                ? "bg-indigo-600 text-white rounded-tr-xs"
                                : "bg-slate-100 text-slate-900 rounded-tl-xs"
                            }`}
                          >
                            {msg.message_text}
                          </div>

                          {/* Emoji Reactions List */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Object.entries(msg.reactions).map(([emoji, users]) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(msg.id, emoji)}
                                  className={`px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 transition-colors ${
                                    users.length > 0
                                      ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-medium"
                                      : "bg-slate-50 border-slate-200 text-slate-600"
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span className="text-[10px]">{users.length}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Hover Action Bar: Emoji reactions & reply */}
                          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {EMOJIS.slice(0, 4).map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msg.id, emoji)}
                                className="p-1 hover:bg-slate-100 rounded text-xs transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                            <button
                              onClick={() => setReplyTo(msg)}
                              className="p-1 text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 ml-1"
                            >
                              <Reply className="w-3 h-3" />
                              <span className="text-[10px]">Reply</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Preview if active */}
              {replyTo && (
                <div className="px-6 py-2 bg-indigo-50/70 border-t border-indigo-100 flex items-center justify-between text-xs text-indigo-800">
                  <div className="flex items-center gap-2 truncate">
                    <Reply className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Replying to <strong>{replyTo.sender_name}</strong>: &ldquo;{replyTo.message_text}&rdquo;</span>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Message Composer Bar */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-white">
                <div className="flex items-center gap-2 bg-slate-50 rounded-2xl border border-slate-200/80 p-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={`Message #${activeChannel.name}...`}
                    className="flex-1 bg-transparent border-0 outline-none px-2 text-sm text-slate-800 placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={sending || !messageText.trim()}
                    className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white transition-colors"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
              <MessageSquare className="w-10 h-10 text-slate-300 mb-2" />
              <p>Select a channel from the left sidebar to start messaging</p>
            </div>
          )}
        </div>
      </div>

      {/* New Channel Modal */}
      {newChannelOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Create New Channel</h3>
              <button onClick={() => setNewChannelOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChannelSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Channel Name</label>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-slate-400 text-sm">#</span>
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="e.g. project-apollo"
                    className="flex-1 text-sm bg-transparent outline-none text-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Department</label>
                <select
                  value={newChannelDept}
                  onChange={(e) => setNewChannelDept(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none"
                >
                  <option value="General">General</option>
                  <option value="Engineering">Engineering</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="Analytics">Analytics</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description (Optional)</label>
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel about?"
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewChannelOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingChannel || !newChannelName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                >
                  {creatingChannel && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Channel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

