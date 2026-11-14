"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  apiGetEmployees,
  apiGetDepartments,
  apiUpdateProfile,
  EmployeeItem,
} from "@/lib/api";
import {
  Users,
  Search,
  Mail,
  MessageSquare,
  Calendar,
  Phone,
  Shield,
  Edit3,
  Check,
  X,
  Loader2,
} from "lucide-react";

export default function DirectoryPage() {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [departments, setDepartments] = useState<Array<{ name: string; count: number }>>([]);
  const [selectedDept, setSelectedDept] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Edit My Profile modal state
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [myTitle, setMyTitle] = useState("");
  const [myPhone, setMyPhone] = useState("");
  const [myDept, setMyDept] = useState("General");
  const [myStatus, setMyStatus] = useState<"online" | "busy" | "away">("online");
  const [myStatusMsg, setMyStatusMsg] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const router = useRouter();

  useEffect(() => {
    loadDirectory();
  }, [selectedDept]);

  const loadDirectory = async () => {
    setLoading(true);
    try {
      const [empData, deptData] = await Promise.all([
        apiGetEmployees(selectedDept, searchQuery),
        apiGetDepartments(),
      ]);
      setEmployees(empData.employees || []);
      setDepartments(deptData.departments || []);

      const me = empData.employees?.find((e: EmployeeItem) => e.is_me);
      if (me) {
        setMyTitle(me.title || "");
        setMyPhone(me.phone || "");
        setMyDept(me.department || "General");
        setMyStatus(me.status as any || "online");
        setMyStatusMsg(me.status_message || "");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadDirectory();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiUpdateProfile({
        title: myTitle,
        phone: myPhone,
        department: myDept,
        status: myStatus,
        status_message: myStatusMsg,
      });
      setEditProfileOpen(false);
      loadDirectory();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Employee Directory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Department roster, roles, verified on-premises contact info & team availability
          </p>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, role, email..."
              className="pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-sm rounded-xl border border-slate-200 outline-none w-64 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </form>

          <button
            onClick={() => setEditProfileOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            <span>Update My Status</span>
          </button>
        </div>
      </div>

      {/* Department Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
        {departments.map((dept) => {
          const isSelected = selectedDept === dept.name;
          return (
            <button
              key={dept.name}
              onClick={() => setSelectedDept(dept.name)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
              }`}
            >
              <span>{dept.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {dept.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Employee Cards Grid */}
      {loading ? (
        <div className="py-24 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : employees.length === 0 ? (
        <div className="py-24 text-center text-slate-400 text-sm">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p>No employees found for this department</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Card Header: Avatar + Status + Department */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-xs">
                        {emp.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-white ${
                          emp.status === "online"
                            ? "bg-emerald-500"
                            : emp.status === "busy"
                            ? "bg-rose-500"
                            : "bg-slate-400"
                        }`}
                        title={`Status: ${emp.status}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{emp.full_name}</h3>
                        {emp.is_me && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{emp.title}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {emp.department}
                  </span>
                </div>

                {/* Status Message if any */}
                {emp.status_message && (
                  <p className="text-xs italic text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 mt-3">
                    &ldquo;{emp.status_message}&rdquo;
                  </p>
                )}

                {/* Contact Meta */}
                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{emp.phone}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => router.push(`/app/mail`)}
                  className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-300" />
                  <span>Send Corporate Email</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Update Profile & Availability</h3>
              <button onClick={() => setEditProfileOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Job Title</label>
                <input
                  type="text"
                  value={myTitle}
                  onChange={(e) => setMyTitle(e.target.value)}
                  placeholder="e.g. Lead Analyst / Operations Manager"
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                <select
                  value={myDept}
                  onChange={(e) => setMyDept(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none"
                >
                  <option value="General">General</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="Analytics">Analytics</option>
                  <option value="Operations">Operations</option>
                  <option value="Management">Management</option>
                  <option value="Engineering">Engineering</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Availability Status</label>
                <select
                  value={myStatus}
                  onChange={(e: any) => setMyStatus(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none"
                >
                  <option value="online">Online (Available)</option>
                  <option value="busy">Busy (In Meetings)</option>
                  <option value="away">Away</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status Message</label>
                <input
                  type="text"
                  value={myStatusMsg}
                  onChange={(e) => setMyStatusMsg(e.target.value)}
                  placeholder="e.g. Working on Q3 financial audit"
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Internal Phone Extension</label>
                <input
                  type="text"
                  value={myPhone}
                  onChange={(e) => setMyPhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                >
                  {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

