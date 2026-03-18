import { useState, useEffect, useRef, useCallback } from "react";
import { Check, Trash2, Play, Plus, Calendar, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Types
export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskFilter = "all" | "todo" | "in-progress" | "done";

export interface FlowTask {
  id: string;
  name: string;
  priority: TaskPriority;
  pomodoroEstimate: number;
  pomodoroCount: number;
  status: TaskStatus;
  dueDate: string | null; // ISO date string
  createdAt: number;
}

const TASKS_KEY = "flowcast_tasks";
const ACTIVE_TASK_KEY = "flowcast_active_task";

function loadTasks(): FlowTask[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: FlowTask[]) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function loadActiveTaskId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TASK_KEY);
  } catch {
    return null;
  }
}

function saveActiveTaskId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_TASK_KEY, id);
  else localStorage.removeItem(ACTIVE_TASK_KEY);
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-emerald-500",
};

const PRIORITY_CYCLE: TaskPriority[] = ["high", "medium", "low"];

function getDueLabel(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / (86400000));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return "Overdue";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMotivationText(weatherCode: number | undefined, hour: number): string {
  const isNight = hour >= 21 || hour < 5;
  const isMorning = hour >= 5 && hour < 12;

  if (isNight) return "🌙 Late night session? Focus on your top priority first.";

  if (weatherCode !== undefined) {
    if (weatherCode >= 51 && weatherCode <= 82) {
      return "🌧️ Rainy day — perfect for deep focus. Let's clear your list!";
    }
    if (weatherCode === 0) {
      return isMorning
        ? "☀️ Sunny morning! Start strong and power through."
        : "☀️ Sunny outside! Finish strong then take a break.";
    }
    if (weatherCode >= 1 && weatherCode <= 3) {
      return "☁️ Cloudy skies, clear mind. One task at a time.";
    }
    if (weatherCode >= 95) {
      return "⛈️ Stormy weather — hunker down and get things done!";
    }
  }

  return isMorning
    ? "🌅 Fresh start! What will you accomplish today?"
    : "💪 Keep the momentum going. You've got this!";
}

interface TaskListProps {
  activeTaskId: string | null;
  onActiveTaskChange: (id: string | null) => void;
  tasks: FlowTask[];
  onTasksChange: (tasks: FlowTask[]) => void;
  timerRunning: boolean;
  weatherCode?: number;
}

export function useTaskState() {
  const [tasks, setTasks] = useState<FlowTask[]>(loadTasks);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(loadActiveTaskId);

  useEffect(() => { saveTasks(tasks); }, [tasks]);
  useEffect(() => { saveActiveTaskId(activeTaskId); }, [activeTaskId]);

  const incrementPomodoro = useCallback((taskId: string) => {
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id !== taskId) return t;
        const newCount = t.pomodoroCount + 1;
        if (newCount >= t.pomodoroEstimate) {
          setTimeout(() => {
            toast({
              title: `🎉 All sessions done for "${t.name}"!`,
              description: "Mark it as done?",
              action: (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTasks(p => p.map(x => x.id === t.id ? { ...x, status: "done" } : x));
                    }}
                    className="rounded-md bg-foreground text-background px-3 py-1 text-xs font-medium"
                  >
                    ✓ Mark Done
                  </button>
                </div>
              ),
            });
          }, 100);
        }
        return { ...t, pomodoroCount: newCount };
      });
      return updated;
    });
  }, []);

  return { tasks, setTasks, activeTaskId, setActiveTaskId, incrementPomodoro };
}

export function TaskList({
  activeTaskId,
  onActiveTaskChange,
  tasks,
  onTasksChange,
  timerRunning,
  weatherCode,
}: TaskListProps) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [showAddRow, setShowAddRow] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newEstimate, setNewEstimate] = useState(1);
  const [newDueDate, setNewDueDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hour = new Date().getHours();
  const motivation = getMotivationText(weatherCode, hour);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" || e.key === "N") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setShowAddRow(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (showAddRow) inputRef.current?.focus();
  }, [showAddRow]);

  const addTask = () => {
    if (!newName.trim()) return;
    const task: FlowTask = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      priority: newPriority,
      pomodoroEstimate: newEstimate,
      pomodoroCount: 0,
      status: "todo",
      dueDate: newDueDate || null,
      createdAt: Date.now(),
    };
    onTasksChange([task, ...tasks]);
    setNewName("");
    setNewPriority("medium");
    setNewEstimate(1);
    setNewDueDate("");
    setShowAddRow(false);
  };

  const removeTask = (id: string) => {
    onTasksChange(tasks.filter(t => t.id !== id));
    if (activeTaskId === id) onActiveTaskChange(null);
  };

  const toggleComplete = (id: string) => {
    onTasksChange(tasks.map(t => {
      if (t.id !== id) return t;
      const newStatus = t.status === "done" ? "todo" : "done";
      if (newStatus === "done" && activeTaskId === id) onActiveTaskChange(null);
      return { ...t, status: newStatus };
    }));
  };

  const setFocusTask = (id: string) => {
    onTasksChange(tasks.map(t => {
      if (t.id === id) return { ...t, status: "in-progress" as TaskStatus };
      if (t.id === activeTaskId && t.status === "in-progress") return { ...t, status: "todo" as TaskStatus };
      return t;
    }));
    onActiveTaskChange(id);
  };

  const saveInlineEdit = (id: string) => {
    if (editingName.trim()) {
      onTasksChange(tasks.map(t => t.id === id ? { ...t, name: editingName.trim() } : t));
    }
    setEditingId(null);
  };

  // Filter + sort (done at bottom)
  const filtered = tasks
    .filter(t => {
      if (filter === "all") return true;
      return t.status === filter;
    })
    .sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      return 0;
    });

  const counts = {
    all: tasks.length,
    todo: tasks.filter(t => t.status === "todo").length,
    "in-progress": tasks.filter(t => t.status === "in-progress").length,
    done: tasks.filter(t => t.status === "done").length,
  };

  const filters: { key: TaskFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "todo", label: "Todo" },
    { key: "in-progress", label: "In Progress" },
    { key: "done", label: "Done" },
  ];

  return (
    <div
      className={`w-full space-y-3 transition-opacity duration-300 ${timerRunning ? "opacity-80" : "opacity-100"}`}
    >
      {/* Weather motivation */}
      <p className="text-xs text-muted-foreground text-center italic">
        {motivation}
      </p>

      {/* Filter tabs */}
      <div className="flex items-center justify-center gap-1 rounded-full border border-border/60 bg-secondary/50 p-1">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-200 ${
              filter === f.key
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}{" "}
            <span className={`${filter === f.key ? "text-background/70" : "text-muted-foreground/60"}`}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Add task button / inline row */}
      {!showAddRow ? (
        <button
          onClick={() => setShowAddRow(true)}
          className="flex items-center gap-1.5 mx-auto rounded-full border border-border/60 bg-secondary/50 px-4 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-300 hover:bg-secondary/80 hover:text-foreground"
        >
          <Plus size={12} /> Add Task
          <span className="text-[10px] text-muted-foreground/50 ml-1">(N)</span>
        </button>
      ) : (
        <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") addTask();
                if (e.key === "Escape") setShowAddRow(false);
              }}
              placeholder="Type task name..."
              className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {/* Priority toggle */}
            <button
              onClick={() => {
                const idx = PRIORITY_CYCLE.indexOf(newPriority);
                setNewPriority(PRIORITY_CYCLE[(idx + 1) % 3]);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-secondary/50 transition-colors hover:bg-secondary/80"
              title={`Priority: ${newPriority}`}
            >
              <div className={`h-2.5 w-2.5 rounded-full ${PRIORITY_DOT[newPriority]}`} />
            </button>
            {/* Estimate */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>🍅</span>
              <input
                type="number"
                min={1}
                max={10}
                value={newEstimate}
                onChange={e => setNewEstimate(Math.max(1, Math.min(10, Number(e.target.value))))}
                className="w-10 rounded border border-border/60 bg-background px-1.5 py-1 text-center text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar size={12} />
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="rounded border border-border/60 bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddRow(false)}
                className="rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addTask}
                className="rounded-full border border-border/60 bg-foreground text-background px-4 py-1 text-xs font-medium transition-all hover:opacity-90"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task list */}
      {filtered.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {filtered.map(task => {
            const isDone = task.status === "done";
            const isActive = task.id === activeTaskId;
            const isHovered = hoveredId === task.id;
            const dueLabel = getDueLabel(task.dueDate);

            return (
              <div
                key={task.id}
                onMouseEnter={() => setHoveredId(task.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`group relative flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                  isActive
                    ? "bg-accent/80 ring-1 ring-accent-foreground/10 shadow-sm"
                    : isDone
                      ? "opacity-50"
                      : "hover:bg-accent/40"
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleComplete(task.id)}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-200 ${
                    isDone
                      ? "border-foreground bg-foreground text-background"
                      : "border-muted-foreground/40 hover:border-foreground"
                  }`}
                >
                  {isDone && <Check size={10} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {editingId === task.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => saveInlineEdit(task.id)}
                        onKeyDown={e => {
                          if (e.key === "Enter") saveInlineEdit(task.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 bg-transparent text-sm text-foreground outline-none border-b border-foreground/20"
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditingId(task.id);
                          setEditingName(task.name);
                        }}
                        className={`flex-1 text-sm cursor-text truncate transition-all duration-200 ${
                          isDone ? "line-through text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {task.name}
                      </span>
                    )}
                    {/* Priority dot */}
                    <div className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-muted-foreground">
                      🍅 {task.pomodoroCount}/{task.pomodoroEstimate}
                    </span>
                    {dueLabel && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className={`text-[11px] ${dueLabel === "Overdue" ? "text-red-500" : "text-muted-foreground"}`}>
                          Due: {dueLabel}
                        </span>
                      </>
                    )}
                    {!isDone && !isActive && (
                      <button
                        onClick={() => setFocusTask(task.id)}
                        className="ml-auto flex items-center gap-1 rounded-full border border-border/60 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-all hover:bg-secondary/80 hover:text-foreground"
                      >
                        <Play size={8} /> Focus
                      </button>
                    )}
                    {isActive && (
                      <span className="ml-auto text-[10px] font-medium text-foreground/70">
                        ● Focusing
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete on hover */}
                {isHovered && (
                  <button
                    onClick={() => removeTask(task.id)}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && tasks.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          No tasks in this filter.
        </p>
      )}

      {tasks.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          No tasks yet. Press <kbd className="rounded border border-border/60 bg-secondary/50 px-1.5 py-0.5 text-[10px] font-mono">N</kbd> to add one.
        </p>
      )}
    </div>
  );
}
