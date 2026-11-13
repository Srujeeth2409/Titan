"use client";

import React, { useState, useEffect } from "react";
import {
  apiGetTasks,
  apiCreateTask,
  apiUpdateTask,
  apiDeleteTask,
  apiGetEmployees,
  TaskItemData,
  EmployeeItem,
} from "@/lib/api";
import {
  CheckSquare,
  Plus,
  LayoutGrid,
  List as ListIcon,
  Clock,
  User,
  AlertCircle,
  Trash2,
  X,
  Loader2,
  Calendar,
} from "lucide-react";

const COLUMNS = [
  { id: "todo", label: "To Do", color: "bg-slate-100 text-slate-700" },
  { id: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700" },
  { id: "in_review", label: "In Review", color: "bg-purple-100 text-purple-700" },
  { id: "completed", label: "Completed", color: "bg-emerald-100 text-emerald-700" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItemData[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [filterView, setFilterView] = useState("all"); // all, me, team
  const [loading, setLoading] = useState(true);

  // Create Task Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [taskStatus, setTaskStatus] = useState<"todo" | "in_progress" | "in_review" | "completed">("todo");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDept, setTaskDept] = useState("General");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTasks();
    loadEmployees();
  }, [filterView]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await apiGetTasks(filterView);
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("Failed to load tasks:", err);
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

  const handleStatusChange = async (taskId: string, newStatus: any) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    try {
      await apiUpdateTask(taskId, { status: newStatus });
    } catch (err) {
      console.error(err);
      loadTasks();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await apiDeleteTask(taskId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setCreating(true);
    try {
      await apiCreateTask({
        title: taskTitle.trim(),
        description: taskDesc,
        priority: taskPriority,
        status: taskStatus,
        department: taskDept,
        assignee_name: taskAssignee,
        due_date: taskDueDate || undefined,
      });
      setCreateOpen(false);
      resetForm();
      loadTasks();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTaskTitle("");
    setTaskDesc("");
    setTaskPriority("medium");
    setTaskStatus("todo");
    setTaskAssignee("");
    setTaskDept("General");
    setTaskDueDate("");
  };

  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case "urgent":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">Urgent</span>;
      case "high":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">High</span>;
      case "medium":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">Medium</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">Low</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-6 py-6 h-[calc(100vh-180px)] flex flex-col">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Titan Tasks & Workflows</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Team task assignments, sprint tracking, and automated meeting action items
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Filter Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200/60 text-xs font-semibold">
            <button
              onClick={() => setFilterView("all")}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterView === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Tasks
            </button>
            <button
              onClick={() => setFilterView("me")}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterView === "me" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Assigned to Me
            </button>
            <button
              onClick={() => setFilterView("team")}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterView === "team" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Department
            </button>
          </div>

          {/* Kanban / List Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200/60">
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "kanban" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
              }`}
              title="Kanban Board"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "list" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
              }`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Main Task Viewport */}
      <div className="flex-1 overflow-hidden pt-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : viewMode === "kanban" ? (
          /* Kanban Board */
          <div className="h-full grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-2">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className="bg-slate-100/60 rounded-2xl p-3 border border-slate-200/60 flex flex-col overflow-hidden"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 px-1">
                    <span className="text-xs font-bold text-slate-800">{col.label}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white text-slate-600 text-[11px] font-bold border border-slate-200">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Task Cards Scroll Container */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {colTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow group flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-900 leading-snug">{task.title}</h4>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {task.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">{task.description}</p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                          {getPriorityBadge(task.priority)}

                          {/* Quick Stage Move Dropdown */}
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task.id, e.target.value)}
                            className="text-[10px] font-medium bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-600 outline-none"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="in_review">In Review</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{task.assignee_name || "Unassigned"}</span>
                          </span>
                          <span className="capitalize">{task.department}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="h-full bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-y-auto divide-y divide-slate-100">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{task.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span>{task.assignee_name || "Staff"}</span>
                      <span>•</span>
                      <span>{task.department}</span>
                      {task.due_date && (
                        <>
                          <span>•</span>
                          <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getPriorityBadge(task.priority)}
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                    className="text-xs font-semibold rounded-xl border border-slate-200 px-2.5 py-1 text-slate-700 bg-white"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Create New Task</h3>
              <button onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Task Title</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Conduct security penetration review"
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Details, acceptance criteria, or relevant file links..."
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e: any) => setTaskPriority(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Stage</label>
                  <select
                    value={taskStatus}
                    onChange={(e: any) => setTaskStatus(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Assignee</label>
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  >
                    <option value="">Select Employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.full_name}>
                        {emp.full_name} ({emp.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                  <select
                    value={taskDept}
                    onChange={(e) => setTaskDept(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Finance">Finance</option>
                    <option value="HR">HR</option>
                    <option value="Analytics">Analytics</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none"
                />
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
                  <span>Save Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

