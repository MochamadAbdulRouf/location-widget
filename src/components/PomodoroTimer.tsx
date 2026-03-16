import { useState, useEffect, useCallback, useRef } from "react";
import { RotateCcw, Plus, Check, X } from "lucide-react";

// Types
interface PomodoroTask {
  id: string;
  name: string;
  estimate: number;
  completed: boolean;
}

type PomodoroMode = "pomodoro" | "shortBreak" | "longBreak";

const MODE_CONFIG: Record<PomodoroMode, { label: string; duration: number; color: string; ringColor: string }> = {
  pomodoro: { label: "Pomodoro", duration: 25 * 60, color: "hsl(0 70% 55%)", ringColor: "hsl(0 70% 55%)" },
  shortBreak: { label: "Short Break", duration: 5 * 60, color: "hsl(160 60% 45%)", ringColor: "hsl(160 60% 45%)" },
  longBreak: { label: "Long Break", duration: 15 * 60, color: "hsl(220 70% 55%)", ringColor: "hsl(220 70% 55%)" },
};

function loadTasks(): PomodoroTask[] {
  try {
    const raw = localStorage.getItem("pomodoro-tasks");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTasks(tasks: PomodoroTask[]) {
  localStorage.setItem("pomodoro-tasks", JSON.stringify(tasks));
}

function loadSessions(): number {
  try {
    return Number(localStorage.getItem("pomodoro-sessions") || "0");
  } catch { return 0; }
}

function saveSessions(n: number) {
  localStorage.setItem("pomodoro-sessions", String(n));
}

function loadActiveTaskId(): string | null {
  try {
    return localStorage.getItem("pomodoro-active-task");
  } catch { return null; }
}

function saveActiveTaskId(id: string | null) {
  if (id) localStorage.setItem("pomodoro-active-task", id);
  else localStorage.removeItem("pomodoro-active-task");
}

export function PomodoroTimer() {
  const [mode, setMode] = useState<PomodoroMode>("pomodoro");
  const [timeLeft, setTimeLeft] = useState(MODE_CONFIG.pomodoro.duration);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(loadSessions);
  const [tasks, setTasks] = useState<PomodoroTask[]>(loadTasks);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(loadActiveTaskId);
  const [showTasks, setShowTasks] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskEstimate, setNewTaskEstimate] = useState(1);
  const totalDuration = MODE_CONFIG[mode].duration;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist
  useEffect(() => { saveTasks(tasks); }, [tasks]);
  useEffect(() => { saveActiveTaskId(activeTaskId); }, [activeTaskId]);
  useEffect(() => { saveSessions(sessions); }, [sessions]);

  // Timer
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          // Complete session
          if (mode === "pomodoro") {
            setSessions((s) => {
              const next = (s + 1) % 4;
              return next;
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode]);

  const switchMode = (m: PomodoroMode) => {
    setMode(m);
    setTimeLeft(MODE_CONFIG[m].duration);
    setRunning(false);
  };

  const reset = () => {
    setTimeLeft(MODE_CONFIG[mode].duration);
    setRunning(false);
  };

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

  const progress = timeLeft / totalDuration;
  const { ringColor } = MODE_CONFIG[mode];

  // SVG ring
  const size = 200;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  const addTask = () => {
    if (!newTaskName.trim()) return;
    const task: PomodoroTask = {
      id: crypto.randomUUID(),
      name: newTaskName.trim(),
      estimate: newTaskEstimate,
      completed: false,
    };
    setTasks((prev) => [...prev, task]);
    setNewTaskName("");
    setNewTaskEstimate(1);
  };

  const toggleComplete = (id: string) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (activeTaskId === id) setActiveTaskId(null);
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm">
      {/* Mode tabs */}
      <div className="flex items-center gap-1 rounded-full border border-border/60 bg-secondary/50 p-1">
        {(Object.keys(MODE_CONFIG) as PomodoroMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-300 ${
              mode === m
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {MODE_CONFIG[m].label}
          </button>
        ))}
      </div>

      {/* Timer with ring */}
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute -rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={stroke}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-1000 linear"
          />
        </svg>
        <div className="flex flex-col items-center select-none">
          <div className="flex items-baseline gap-0.5 font-mono tracking-tight">
            <span className="text-5xl font-bold text-foreground">{mm}</span>
            <span className="text-5xl font-bold text-foreground/30 animate-pulse">:</span>
            <span className="text-5xl font-bold text-foreground">{ss}</span>
          </div>
          <span className="mt-1 text-xs text-muted-foreground">{MODE_CONFIG[mode].label}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setRunning((r) => !r)}
          className="rounded-full border border-border/60 bg-secondary/50 px-6 py-2 text-sm font-medium text-foreground transition-all duration-300 hover:bg-secondary/80 hover:border-foreground/20"
        >
          {!running && timeLeft === totalDuration ? "Start" : running ? "Pause" : "Resume"}
        </button>
        <button
          onClick={reset}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-secondary/50 text-muted-foreground transition-all duration-300 hover:bg-secondary/80 hover:text-foreground"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Session dots */}
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition-colors duration-300 ${
              i < sessions ? "bg-foreground" : "bg-border"
            }`}
          />
        ))}
      </div>

      {/* Active task label */}
      <p className="text-xs text-muted-foreground">
        Working on: {activeTask ? activeTask.name : "—"}
      </p>

      {/* Task list */}
      <div className="w-full">
        {!showTasks ? (
          <button
            onClick={() => setShowTasks(true)}
            className="flex items-center gap-1.5 mx-auto rounded-full border border-border/60 bg-secondary/50 px-4 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-300 hover:bg-secondary/80 hover:text-foreground"
          >
            <Plus size={12} />
            Add Task
          </button>
        ) : (
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Add task input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="Task name..."
                className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>🍅</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={newTaskEstimate}
                  onChange={(e) => setNewTaskEstimate(Math.max(1, Math.min(10, Number(e.target.value))))}
                  className="w-10 rounded border border-border/60 bg-background px-1.5 py-1 text-center text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <button
                onClick={addTask}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-secondary/50 text-foreground transition-colors hover:bg-secondary/80"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Task list */}
            {tasks.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setActiveTaskId(task.id)}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${
                      task.id === activeTaskId
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50 text-foreground"
                    }`}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleComplete(task.id); }}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        task.completed
                          ? "border-foreground bg-foreground text-background"
                          : "border-border"
                      }`}
                    >
                      {task.completed && <Check size={10} />}
                    </button>
                    <span className={`flex-1 truncate ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                      {task.name}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">🍅 x{task.estimate}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeTask(task.id); }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowTasks(false)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Collapse
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
