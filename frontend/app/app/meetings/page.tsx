"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiGetMeetings, apiCreateMeeting, MeetingItem } from "@/lib/api";
import {
  Video,
  Plus,
  ArrowRight,
  Calendar,
  Users,
  Clock,
  Sparkles,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";

export default function MeetingsDashboard() {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [newMeetingModalOpen, setNewMeetingModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDept, setNewDept] = useState("General");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    setLoading(true);
    try {
      const data = await apiGetMeetings();
      setMeetings(data.meetings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartInstant = async () => {
    setCreating(true);
    try {
      const res = await apiCreateMeeting({
        title: "Instant Video Meeting",
        department: "General",
      });
      if (res.meeting?.room_code) {
        router.push(`/app/meetings/${res.meeting.room_code}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    router.push(`/app/meetings/${joinCode.trim()}`);
  };

  const handleCreateScheduled = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await apiCreateMeeting({
        title: newTitle.trim(),
        department: newDept,
      });
      if (res.meeting?.room_code) {
        setNewMeetingModalOpen(false);
        setNewTitle("");
        loadMeetings();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-6 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Titan Video Meetings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Secure, air-gapped on-premises video conferencing with local signaling, screen sharing & AI action items.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleStartInstant}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
            <span>Start Instant Meeting</span>
          </button>

          <button
            onClick={() => setNewMeetingModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Meeting</span>
          </button>
        </div>
      </div>

      {/* Join Box & Quick Actions Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl p-6 text-white shadow-lg flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center mb-4 backdrop-blur-xs">
              <Video className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold">Instant Video Room</h3>
            <p className="text-xs text-indigo-100 mt-1">
              One-click encrypted internal room. No cloud signaling or external accounts required.
            </p>
          </div>
          <button
            onClick={handleStartInstant}
            className="mt-6 w-full py-2.5 rounded-xl bg-white text-indigo-700 text-xs font-bold hover:bg-indigo-50 transition-colors shadow-sm"
          >
            Launch Now
          </button>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-slate-700">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Join with Room Code</h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter an internal meeting room code shared by your colleague.
            </p>
          </div>
          <form onSubmit={handleJoinWithCode} className="mt-4 flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="e.g. ttn-4a9f-b2c1"
              className="flex-1 text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none font-mono focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
            >
              Join
            </button>
          </form>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Meeting Action Items</h3>
            <p className="text-xs text-slate-500 mt-1">
              Live in-meeting action item notes convert automatically to team tasks in Titan Tasks.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Titan Tasks Integration Active</span>
          </div>
        </div>
      </div>

      {/* Recent & Scheduled Meetings List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Recent & Scheduled Meetings</h2>
          <span className="text-xs text-slate-400">{meetings.length} rooms</span>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Video className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p>No meeting rooms found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {meetings.map((m) => (
              <div
                key={m.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-2.5 rounded-xl ${m.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{m.title}</h4>
                      {m.is_active && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold animate-pulse">
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>Host: {m.host_name}</span>
                      <span>•</span>
                      <span className="font-mono">Room: {m.room_code}</span>
                      <span>•</span>
                      <span>{m.department}</span>
                      {m.action_items_count && m.action_items_count > 0 ? (
                        <>
                          <span>•</span>
                          <span className="text-indigo-600 font-medium">
                            {m.action_items_count} Action items
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/app/meetings/${m.room_code}`)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold rounded-xl transition-colors"
                >
                  <span>Enter Room</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {newMeetingModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Schedule Video Meeting</h3>
              <button onClick={() => setNewMeetingModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateScheduled} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Meeting Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Weekly Operations Sync"
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none"
                >
                  <option value="General">General</option>
                  <option value="Operations">Operations</option>
                  <option value="Finance">Finance</option>
                  <option value="Engineering">Engineering</option>
                  <option value="HR">HR</option>
                  <option value="Analytics">Analytics</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewMeetingModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Meeting</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

