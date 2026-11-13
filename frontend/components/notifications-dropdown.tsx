"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Mail, MessageSquare, Calendar, CheckSquare, Info } from "lucide-react";
import { apiGetNotifications, apiMarkNotificationRead, apiMarkAllNotificationsRead, NotificationItem } from "@/lib/api";

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const loadNotifications = async () => {
    try {
      const data = await apiGetNotifications();
      setUnreadCount(data.unread_count || 0);
      setNotifications(data.notifications || []);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiMarkAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      try {
        await apiMarkNotificationRead(notif.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch (err) {
        console.error(err);
      }
    }
    setIsOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "mail":
        return <Mail className="w-4 h-4 text-sky-500" />;
      case "chat":
        return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case "calendar":
        return <Calendar className="w-4 h-4 text-amber-500" />;
      case "task":
        return <CheckSquare className="w-4 h-4 text-indigo-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          style={{
            boxShadow: "0 20px 40px rgba(15, 23, 42, 0.15)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[11px] font-semibold">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No notifications right now</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-slate-50/80 transition-colors cursor-pointer ${
                    !n.is_read ? "bg-indigo-50/30" : ""
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-100 shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs ${!n.is_read ? "font-semibold text-slate-900" : "font-medium text-slate-700"} truncate`}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

