"use client";

import React, { useState, useEffect } from "react";
import {
  apiGetCalendarEvents,
  apiCreateCalendarEvent,
  apiDeleteCalendarEvent,
  apiCheckCalendarConflicts,
  apiGetEmployees,
  CalendarEventItem,
  EmployeeItem,
} from "@/lib/api";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  Video,
  AlertTriangle,
  X,
  Loader2,
  Trash2,
} from "lucide-react";

export default function CalendarPage() {
  const [view, setView] = useState<"day" | "week" | "month">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New Event Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [endTime, setEndTime] = useState("10:00");
  const [eventLocation, setEventLocation] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);

  useEffect(() => {
    loadEvents();
    loadEmployees();
  }, [currentDate, view]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await apiGetCalendarEvents();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await apiGetEmployees();
      setEmployees(data.employees || []);
    } catch {
      // Ignore
    }
  };

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (view === "month") next.setMonth(next.getMonth() - 1);
    else if (view === "week") next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (view === "month") next.setMonth(next.getMonth() + 1);
    else if (view === "week") next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  // Conflict Check
  useEffect(() => {
    if (!createOpen) return;
    const checkConflicts = async () => {
      try {
        const sISO = `${startDate}T${startTime}:00`;
        const eISO = `${endDate}T${endTime}:00`;
        const res = await apiCheckCalendarConflicts({
          start_time: sISO,
          end_time: eISO,
          attendees: selectedAttendees,
        });
        if (res.has_conflicts) {
          const names = res.conflicts.map((c: any) => c.title).join(", ");
          setConflictWarning(`Conflict detected with existing event: ${names}`);
        } else {
          setConflictWarning(null);
        }
      } catch {
        setConflictWarning(null);
      }
    };
    const t = setTimeout(checkConflicts, 400);
    return () => clearTimeout(t);
  }, [startDate, startTime, endDate, endTime, selectedAttendees, createOpen]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;

    setCreating(true);
    try {
      const sISO = `${startDate}T${startTime}:00`;
      const eISO = `${endDate}T${endTime}:00`;
      await apiCreateCalendarEvent({
        title: eventTitle.trim(),
        description: eventDesc,
        start_time: sISO,
        end_time: eISO,
        location: eventLocation,
        recurrence,
        attendees: selectedAttendees,
        meeting_link: eventLocation.includes("http") ? eventLocation : `/app/meetings/${Math.random().toString(36).slice(2, 8)}`,
      });
      setCreateOpen(false);
      resetForm();
      loadEvents();
    } catch (err) {
      console.error("Failed to create event:", err);
      alert("Failed to schedule event.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await apiDeleteCalendarEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setEventTitle("");
    setEventDesc("");
    setEventLocation("");
    setSelectedAttendees([]);
    setConflictWarning(null);
  };

  // Month Grid Calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const daysArray = [];
  for (let i = 0; i < firstDay; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    daysArray.push(d);
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-6 py-6 h-[calc(100vh-180px)] flex flex-col">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Company Calendar</h1>
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200/60">
            <button
              onClick={() => setView("day")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                view === "day" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                view === "week" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView("month")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                view === "month" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Month
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-slate-800 min-w-[140px] text-center">
              {monthName}
            </span>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* Main Calendar Viewport */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden mt-4">
        {view === "month" && (
          <div className="flex-1 flex flex-col">
            {/* Weekday Labels */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60 text-center py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Days Grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 divide-x divide-y divide-slate-100 overflow-hidden">
              {daysArray.map((dayNum, idx) => {
                if (dayNum === null) {
                  return <div key={`empty-${idx}`} className="bg-slate-50/20" />;
                }

                const dayDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const dayEvents = events.filter((e) => e.start_time.startsWith(dayDateStr));
                const isToday =
                  new Date().getDate() === dayNum &&
                  new Date().getMonth() === month &&
                  new Date().getFullYear() === year;

                return (
                  <div
                    key={dayNum}
                    onClick={() => {
                      setStartDate(dayDateStr);
                      setEndDate(dayDateStr);
                      setCreateOpen(true);
                    }}
                    className="p-2 flex flex-col overflow-hidden hover:bg-indigo-50/20 transition-colors cursor-pointer group/cell"
                  >
                    <div className="flex items-center justify-between mb-1 pointer-events-none">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isToday ? "bg-indigo-600 text-white font-bold" : "text-slate-700"
                        }`}
                      >
                        {dayNum}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 overflow-y-auto flex-1">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(ev);
                          }}
                          className="px-2 py-1 rounded-lg text-[11px] font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-100 truncate flex items-center justify-between group cursor-pointer transition-colors"
                        >
                          <span className="truncate">{ev.title}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEvent(ev.id);
                            }}
                            className="text-indigo-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 ml-1"
                            title="Delete event"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-slate-400 font-medium px-1 block">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(view === "day" || view === "week") && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Upcoming Scheduled Meetings & Events</h3>
            {events.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">No scheduled events found</div>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{ev.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {new Date(ev.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                            {new Date(ev.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </span>
                        {ev.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{ev.location}</span>
                          </span>
                        )}
                        {ev.attendees && ev.attendees.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>{ev.attendees.length} Attendees</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {ev.meeting_link && (
                      <a
                        href={ev.meeting_link}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join</span>
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* New Event Modal with Conflict Warning */}
      {createOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Schedule Meeting / Event</h3>
              <button onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Event Title</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. Q4 Executive Strategy Session"
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date & Time</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 px-2.5 py-2 outline-none"
                    />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="text-xs rounded-xl border border-slate-200 px-2 py-2 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">End Date & Time</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 px-2.5 py-2 outline-none"
                    />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="text-xs rounded-xl border border-slate-200 px-2 py-2 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Conflict Detection Banner */}
              {conflictWarning && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Schedule Conflict Detected</span>
                    <span>{conflictWarning}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Invite Attendees</label>
                <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                  {employees.map((emp) => {
                    const isSelected = selectedAttendees.includes(emp.email);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedAttendees(selectedAttendees.filter((e) => e !== emp.email));
                          } else {
                            setSelectedAttendees([...selectedAttendees, emp.email]);
                          }
                        }}
                        className={`flex items-center justify-between px-2.5 py-1 rounded-lg text-xs cursor-pointer ${
                          isSelected ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span>{emp.full_name} ({emp.email})</span>
                        <span className="text-[10px] text-slate-400 capitalize">{emp.department}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Location or Meeting Link</label>
                  <input
                    type="text"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="Room 402 or Titan Video"
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Recurrence</label>
                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
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
                  <span>Schedule Event</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Event Details Popup Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md w-full space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Scheduled Event
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{selectedEvent.title}</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedEvent.description && (
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {selectedEvent.description}
              </p>
            )}

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>
                  {new Date(selectedEvent.start_time).toLocaleDateString([], { month: "short", day: "numeric" })} •{" "}
                  {new Date(selectedEvent.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                  {new Date(selectedEvent.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {selectedEvent.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}

              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-medium text-slate-700">Attendees:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedEvent.attendees.map((att) => (
                        <span key={att} className="px-2 py-0.5 bg-slate-100 rounded-md text-[11px] text-slate-600">
                          {att}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  await handleDeleteEvent(selectedEvent.id);
                  setSelectedEvent(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                {selectedEvent.meeting_link && (
                  <a
                    href={selectedEvent.meeting_link}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Join Video Meeting</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

