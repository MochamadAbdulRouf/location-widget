import { useState, useEffect, useRef, useCallback } from "react";
import { RotateCcw, Plus, Check, X, Settings } from "lucide-react";
import { logSession } from "./PomodoroStats";

// Notification helpers
function playAlarmSound() {
  try {
    const ctx = new AudioContext();
    const times = [0, 0.25, 0.5];
    times.forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 830;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    });
  } catch (e) {
    console.warn("Could not play sound:", e);
  }
}

function sendBrowserNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "🎯" });
  }
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// Types
interface PomodoroTask {
  id: string;
  name: string;
  estimate: number;
  completed: boolean;
}

type PomodoroMode = "pomodoro" | "shortBreak" | "longBreak";

interface DurationSettings {
  pomodoro: number;
  shortBreak: number;
  longBreak: number;
}

const DEFAULT_DURATIONS: DurationSettings = {
  pomodoro: 25,
  shortBreak: 5,
  longBreak: 15,
};

const MODE_META: Record<PomodoroMode, { label: string; ringColor: string }> = {
  pomodoro: { label: "Work Focus", ringColor: "hsl(0 70% 55%)" },
  shortBreak: { label: "Short Break", ringColor: "hsl(160 60% 45%)" },
  longBreak: { label: "Long Break", ringColor: "hsl(220 70% 55%)" },
};

// localStorage helpers
function loadJson<T>(key: string, fallback: T): T {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val));
}
function loadNum(key: string, fallback: number): number {
  try {
    return Number(localStorage.getItem(key) ?? fallback);
  } catch {
    return fallback;
  }
}

export function PomodoroTimer() {
  // Settings
  const [durations, setDurations] = useState<DurationSettings>(() =>
    loadJson("pomodoro-durations", DEFAULT_DURATIONS),
  );
  const [longBreakInterval, setLongBreakInterval] = useState(() =>
    loadNum("pomodoro-long-break-interval", 4),
  );
  const [autoStart, setAutoStart] = useState(() =>
    loadJson("pomodoro-auto-start", true),
  );
  const [showSettings, setShowSettings] = useState(false);
  const [draftDurations, setDraftDurations] = useState(durations);
  const [draftLongBreakInterval, setDraftLongBreakInterval] =
    useState(longBreakInterval);
  const [draftAutoStart, setDraftAutoStart] = useState(autoStart);

  // Per-mode state preserved across tab switches AND browser refresh
  const [modeTimers, setModeTimers] = useState<Record<PomodoroMode, number>>(
    () => {
      const saved = loadJson<{
        timers: Record<PomodoroMode, number>;
        timestamp: number;
      } | null>("pomodoro-mode-timers", null);
      if (saved && saved.timers) {
        const runningState = loadJson<Record<PomodoroMode, boolean>>(
          "pomodoro-mode-running",
          { pomodoro: false, shortBreak: false, longBreak: false },
        );
        const elapsed = Math.floor((Date.now() - saved.timestamp) / 1000);
        const timers = { ...saved.timers };
        (Object.keys(timers) as PomodoroMode[]).forEach((m) => {
          if (runningState[m]) {
            timers[m] = Math.max(0, timers[m] - elapsed);
          }
        });
        return timers;
      }
      return {
        pomodoro: durations.pomodoro * 60,
        shortBreak: durations.shortBreak * 60,
        longBreak: durations.longBreak * 60,
      };
    },
  );
  const [modeRunning, setModeRunning] = useState<Record<PomodoroMode, boolean>>(
    () => {
      const saved = loadJson<Record<PomodoroMode, boolean>>(
        "pomodoro-mode-running",
        { pomodoro: false, shortBreak: false, longBreak: false },
      );
      const timers = loadJson<{
        timers: Record<PomodoroMode, number>;
        timestamp: number;
      } | null>("pomodoro-mode-timers", null);
      if (timers) {
        const elapsed = Math.floor((Date.now() - timers.timestamp) / 1000);
        (Object.keys(saved) as PomodoroMode[]).forEach((m) => {
          if (saved[m] && timers.timers[m] - elapsed <= 0) {
            saved[m] = false;
          }
        });
      }
      return saved;
    },
  );

  const [mode, setMode] = useState<PomodoroMode>(() => {
    try {
      const s = localStorage.getItem("pomodoro-active-mode");
      return (s as PomodoroMode) || "pomodoro";
    } catch {
      return "pomodoro";
    }
  });
  const [sessions, setSessions] = useState(() =>
    loadNum("pomodoro-sessions", 0),
  );
  const [tasks, setTasks] = useState<PomodoroTask[]>(() =>
    loadJson("pomodoro-tasks", []),
  );
  const [activeTaskId, setActiveTaskId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("pomodoro-active-task");
    } catch {
      return null;
    }
  });
  const [showTasks, setShowTasks] = useState(() => {
    try {
      return localStorage.getItem("pomodoro-show-tasks") === "true";
    } catch {
      return false;
    }
  });
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskEstimate, setNewTaskEstimate] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const initialTimeLeftRef = useRef<number | null>(null);

  // Queue for auto-switching mode after timer completes
  const pendingSwitchRef = useRef<PomodoroMode | null>(null);

  const timeLeft = modeTimers[mode];
  const running = modeRunning[mode];
  const totalDuration = durations[mode] * 60;

  // Persist
  useEffect(() => {
    saveJson("pomodoro-tasks", tasks);
  }, [tasks]);
  useEffect(() => {
    if (activeTaskId)
      localStorage.setItem("pomodoro-active-task", activeTaskId);
    else localStorage.removeItem("pomodoro-active-task");
  }, [activeTaskId]);
  useEffect(() => {
    localStorage.setItem("pomodoro-sessions", String(sessions));
  }, [sessions]);
  useEffect(() => {
    saveJson("pomodoro-durations", durations);
  }, [durations]);
  useEffect(() => {
    localStorage.setItem(
      "pomodoro-long-break-interval",
      String(longBreakInterval),
    );
  }, [longBreakInterval]);
  useEffect(() => {
    saveJson("pomodoro-auto-start", autoStart);
  }, [autoStart]);
  useEffect(() => {
    saveJson("pomodoro-mode-timers", {
      timers: modeTimers,
      timestamp: Date.now(),
    });
  }, [modeTimers]);
  useEffect(() => {
    saveJson("pomodoro-mode-running", modeRunning);
  }, [modeRunning]);
  useEffect(() => {
    localStorage.setItem("pomodoro-active-mode", mode);
  }, [mode]);
  useEffect(() => {
    localStorage.setItem("pomodoro-show-tasks", String(showTasks));
  }, [showTasks]);

  // Auto-switch handler: after state settles, apply pending switch
  useEffect(() => {
    if (pendingSwitchRef.current) {
      const nextMode = pendingSwitchRef.current;
      pendingSwitchRef.current = null;
      // Reset the next mode timer and auto-start it if enabled
      setModeTimers((prev) => ({
        ...prev,
        [nextMode]: durations[nextMode] * 60,
      }));
      setModeRunning((prev) => ({ ...prev, [nextMode]: autoStart }));
      setMode(nextMode);
    }
  });

  // Determine next mode after pomodoro completes
  const getNextModeAfterPomodoro = useCallback(
    (currentSessions: number): PomodoroMode => {
      // currentSessions is the NEW count (after increment)
      if (currentSessions > 0 && currentSessions % longBreakInterval === 0) {
        return "longBreak";
      }
      return "shortBreak";
    },
    [longBreakInterval],
  );

  // Handle timer completion with auto-switch
  const handleTimerComplete = useCallback(
    (completedMode: PomodoroMode) => {
      playAlarmSound();
      const labels = {
        pomodoro: "Work session",
        shortBreak: "Short break",
        longBreak: "Long break",
      };

      if (completedMode === "pomodoro") {
        logSession({
          timestamp: Date.now(),
          duration: durations.pomodoro,
          type: "pomodoro",
        });
        setSessions((prev) => {
          const next = prev + 1;
          const nextMode = getNextModeAfterPomodoro(next);
          sendBrowserNotification(
            `${labels[completedMode]} complete!`,
            `Switching to ${MODE_META[nextMode].label}...`,
          );
          pendingSwitchRef.current = nextMode;
          return next;
        });
      } else {
        // Break finished → switch back to pomodoro
        sendBrowserNotification(
          `${labels[completedMode]} complete!`,
          "Time to work!",
        );
        pendingSwitchRef.current = "pomodoro";
      }
    },
    [getNextModeAfterPomodoro],
  );

  // Request notification permission on first interaction
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Timer tick — runs for the ACTIVE mode only
  useEffect(() => {
    if (!running) {
      startTimeRef.current = null;
      initialTimeLeftRef.current = null;
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Set initial reference points when timer starts/resumes
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      initialTimeLeftRef.current = timeLeft;
    }

    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
      const nextTimeLeft = Math.max(0, initialTimeLeftRef.current! - elapsed);

      setModeTimers((prev) => {
        if (prev[mode] === nextTimeLeft) return prev;
        return { ...prev, [mode]: nextTimeLeft };
      });

      if (nextTimeLeft <= 0) {
        setModeRunning((r) => ({ ...r, [mode]: false }));
        handleTimerComplete(mode);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 200); // Higher frequency for better precision (ui updates still 1s)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode, handleTimerComplete, timeLeft]);

  // Background timer state references to avoid stale closures in bg interval
  const bgRefs = useRef({ modeRunning, modeTimers, durations });
  useEffect(() => {
    bgRefs.current = { modeRunning, modeTimers, durations };
  }, [modeRunning, modeTimers, durations]);

  // Also tick background modes that are running (using a more stable approach)
  useEffect(() => {
    const bgModes = (Object.keys(modeRunning) as PomodoroMode[]).filter(
      (m) => m !== mode && modeRunning[m],
    );
    if (bgModes.length === 0) return;

    // For background modes, we'll use a simpler interval since they are not visible,
    // but the actual "drift" is fixed when they become active or through the elapsed calculation on load.
    const id = setInterval(() => {
      bgModes.forEach((m) => {
        setModeTimers((prev) => {
          const cur = prev[m];
          if (cur <= 1) {
            setModeRunning((r) => ({ ...r, [m]: false }));
            handleTimerComplete(m);
            return { ...prev, [m]: 0 };
          }
          return { ...prev, [m]: cur - 1 };
        });
      });
    }, 1000);
    return () => clearInterval(id);
  }, [mode, modeRunning, handleTimerComplete]);

  const switchMode = (m: PomodoroMode) => {
    setMode(m);
  };

  const toggleRunning = () => {
    setModeRunning((prev) => ({ ...prev, [mode]: !prev[mode] }));
  };

  const reset = () => {
    setModeRunning((prev) => ({ ...prev, [mode]: false }));
    setModeTimers((prev) => ({ ...prev, [mode]: durations[mode] * 60 }));
  };

  const applySettings = () => {
    setDurations(draftDurations);
    setLongBreakInterval(draftLongBreakInterval);
    setAutoStart(draftAutoStart);
    setModeTimers((prev) => {
      const next = { ...prev };
      (Object.keys(draftDurations) as PomodoroMode[]).forEach((m) => {
        if (!modeRunning[m]) {
          next[m] = draftDurations[m] * 60;
        }
      });
      return next;
    });
    setShowSettings(false);
  };

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const progress = totalDuration > 0 ? timeLeft / totalDuration : 1;
  const { ringColor } = MODE_META[mode];

  // SVG ring
  const size = 200;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  const addTask = () => {
    if (!newTaskName.trim()) return;
    setTasks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: newTaskName.trim(),
        estimate: newTaskEstimate,
        completed: false,
      },
    ]);
    setNewTaskName("");
    setNewTaskEstimate(1);
  };

  const toggleComplete = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (activeTaskId === id) setActiveTaskId(null);
  };

  // Session progress toward long break
  const sessionsUntilLongBreak =
    longBreakInterval - (sessions % longBreakInterval);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm">
      {/* Mode tabs + settings */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-secondary/50 p-1">
          {(Object.keys(MODE_META) as PomodoroMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`relative rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-300 ${
                mode === m
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {MODE_META[m].label}
              {m !== mode && modeRunning[m] && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setDraftDurations(durations);
            setDraftLongBreakInterval(longBreakInterval);
            setDraftAutoStart(autoStart);
            setShowSettings((s) => !s);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-secondary/50 text-muted-foreground transition-all duration-300 hover:bg-secondary/80 hover:text-foreground"
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="w-full rounded-xl border border-border/60 bg-secondary/20 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-xs font-medium text-foreground text-center">
            Timer Settings (minutes)
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "pomodoro" as const, label: "Focus" },
              { key: "shortBreak" as const, label: "Short" },
              { key: "longBreak" as const, label: "Long" },
            ].map(({ key, label }) => (
              <div key={key} className="flex flex-col items-center gap-1.5">
                <label className="text-xs text-muted-foreground">{label}</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={draftDurations[key]}
                  onChange={(e) =>
                    setDraftDurations((d) => ({
                      ...d,
                      [key]: Math.max(1, Math.min(120, Number(e.target.value))),
                    }))
                  }
                  className="w-16 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-center text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ))}
          </div>
          {/* Long break interval setting */}
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <label className="text-xs text-muted-foreground">
              Long Break every N sessions
            </label>
            <input
              type="number"
              min={2}
              max={10}
              value={draftLongBreakInterval}
              onChange={(e) =>
                setDraftLongBreakInterval(
                  Math.max(2, Math.min(10, Number(e.target.value))),
                )
              }
              className="w-16 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-center text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Auto-start toggle */}
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <label className="text-xs text-muted-foreground">
              Auto-start Next Session
            </label>
            <button
              onClick={() => setDraftAutoStart(!draftAutoStart)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftAutoStart ? "bg-foreground" : "bg-muted"}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${draftAutoStart ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              onClick={() => setShowSettings(false)}
              className="rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={applySettings}
              className="rounded-full border border-border/60 bg-foreground text-background px-4 py-1.5 text-xs font-medium transition-all hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Timer with ring */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="absolute -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={stroke}
          />
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
            <span className="text-5xl font-bold text-foreground/30 animate-pulse">
              :
            </span>
            <span className="text-5xl font-bold text-foreground">{ss}</span>
          </div>
          <span className="mt-1 text-xs text-muted-foreground">
            {MODE_META[mode].label}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleRunning}
          className="rounded-full border border-border/60 bg-secondary/50 px-6 py-2 text-sm font-medium text-foreground transition-all duration-300 hover:bg-secondary/80 hover:border-foreground/20"
        >
          {!running && timeLeft === totalDuration
            ? "Start"
            : running
              ? "Pause"
              : "Resume"}
        </button>
        <button
          onClick={reset}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-secondary/50 text-muted-foreground transition-all duration-300 hover:bg-secondary/80 hover:text-foreground"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Session dots — shows progress toward long break */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          {Array.from({ length: longBreakInterval }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors duration-300 ${i < sessions % longBreakInterval ? "bg-foreground" : "bg-border"}`}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {sessionsUntilLongBreak === longBreakInterval
            ? `${longBreakInterval} sessions to long break`
            : `${sessionsUntilLongBreak} left to long break`}
        </span>
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
            <Plus size={12} /> Add Task
          </button>
        ) : (
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
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
                <span>🎯</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={newTaskEstimate}
                  onChange={(e) =>
                    setNewTaskEstimate(
                      Math.max(1, Math.min(10, Number(e.target.value))),
                    )
                  }
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
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleComplete(task.id);
                      }}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        task.completed
                          ? "border-foreground bg-foreground text-background"
                          : "border-border"
                      }`}
                    >
                      {task.completed && <Check size={10} />}
                    </button>
                    <span
                      className={`flex-1 truncate ${task.completed ? "line-through text-muted-foreground" : ""}`}
                    >
                      {task.name}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      🎯 x{task.estimate}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTask(task.id);
                      }}
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
