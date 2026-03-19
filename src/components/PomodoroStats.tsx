import { useState, useMemo } from "react";
import { BarChart3, Flame, Clock, Target } from "lucide-react";

export interface SessionLog {
  timestamp: number;
  duration: number; // in minutes
  type: "pomodoro" | "shortBreak" | "longBreak";
}

const STATS_KEY = "pomodoro-session-logs";

export function getSessionLogs(): SessionLog[] {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logSession(entry: SessionLog) {
  const logs = getSessionLogs();
  logs.push(entry);
  // Keep only last 90 days
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const trimmed = logs.filter((l) => l.timestamp > cutoff);
  localStorage.setItem(STATS_KEY, JSON.stringify(trimmed));
}

type ViewMode = "today" | "week";

function getDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDays(): { key: string; label: string }[] {
  const days: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({
      key: getDayKey(d.getTime()),
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
    });
  }
  return days;
}

function getTodayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getWeekStart(): number {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function PomodoroStats() {
  const [view, setView] = useState<ViewMode>("today");
  const [expanded, setExpanded] = useState(false);
  const logs = useMemo(() => getSessionLogs(), [expanded]);

  const focusLogs = logs.filter((l) => l.type === "pomodoro");

  const todayStart = getTodayStart();
  const weekStart = getWeekStart();

  const todayFocus = focusLogs.filter((l) => l.timestamp >= todayStart);
  const weekFocus = focusLogs.filter((l) => l.timestamp >= weekStart);

  const currentLogs = view === "today" ? todayFocus : weekFocus;
  const totalSessions = currentLogs.length;
  const totalMinutes = currentLogs.reduce((sum, l) => sum + l.duration, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;

  // Streak: consecutive days with at least 1 focus session (ending today or yesterday)
  const streak = useMemo(() => {
    const daySet = new Set(focusLogs.map((l) => getDayKey(l.timestamp)));
    let count = 0;
    const d = new Date();
    // Check if today has sessions, if not start from yesterday
    if (!daySet.has(getDayKey(d.getTime()))) {
      d.setDate(d.getDate() - 1);
    }
    while (daySet.has(getDayKey(d.getTime()))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [focusLogs]);

  // Weekly chart data
  const weekDays = useMemo(() => getWeekDays(), []);
  const chartData = useMemo(() => {
    const grouped: Record<string, number> = {};
    weekFocus.forEach((l) => {
      const key = getDayKey(l.timestamp);
      grouped[key] = (grouped[key] || 0) + 1;
    });
    return weekDays.map((d) => ({
      ...d,
      count: grouped[d.key] || 0,
    }));
  }, [weekFocus, weekDays]);

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-4 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-300 hover:bg-secondary/80 hover:text-foreground mx-auto"
      >
        <BarChart3 size={12} /> Statistics
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border/60 bg-secondary/20 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <BarChart3 size={13} /> Focus Statistics
        </p>
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-secondary/50 p-0.5">
          {(["today", "week"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 text-[10px] font-medium transition-all duration-200 ${
                view === v
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "today" ? "Today" : "Week"}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-background/50 p-2.5">
          <Target size={14} className="text-muted-foreground" />
          <span className="text-lg font-bold text-foreground">{totalSessions}</span>
          <span className="text-[10px] text-muted-foreground">Sessions</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-background/50 p-2.5">
          <Clock size={14} className="text-muted-foreground" />
          <span className="text-lg font-bold text-foreground">
            {totalHours > 0 ? `${totalHours}h${remainingMins}m` : `${remainingMins}m`}
          </span>
          <span className="text-[10px] text-muted-foreground">Focus Time</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-background/50 p-2.5">
          <Flame size={14} className="text-muted-foreground" />
          <span className="text-lg font-bold text-foreground">{streak}</span>
          <span className="text-[10px] text-muted-foreground">Day Streak</span>
        </div>
      </div>

      {/* Activity chart (week view) */}
      {view === "week" && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground text-center">
            Weekly Activity
          </p>
          <div className="flex items-end justify-between gap-1.5 h-20 px-1">
            {chartData.map((d) => (
              <div key={d.key} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full flex items-end justify-center h-14">
                  <div
                    className="w-full max-w-[24px] rounded-t-sm bg-foreground/80 transition-all duration-300"
                    style={{
                      height: d.count > 0 ? `${Math.max(8, (d.count / maxCount) * 100)}%` : "3px",
                      opacity: d.count > 0 ? 1 : 0.2,
                    }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">{d.label}</span>
                {d.count > 0 && (
                  <span className="text-[9px] font-medium text-foreground -mt-0.5">
                    {d.count}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today hourly activity */}
      {view === "today" && todayFocus.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground text-center">
            Today's Sessions
          </p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {todayFocus.map((l, i) => {
              const t = new Date(l.timestamp);
              return (
                <div
                  key={i}
                  className="flex items-center gap-1 rounded-full border border-border/40 bg-background/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  <span className="font-medium text-foreground">
                    {t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </span>
                  <span>·</span>
                  <span>{l.duration}m</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded(false)}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Collapse
      </button>
    </div>
  );
}
