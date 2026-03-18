import { useState, useEffect, useRef } from "react";
import { LocationTag, LOCATIONS } from "@/components/ui/location-tag";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PomodoroTimer, useTimerRunning } from "@/components/PomodoroTimer";
import { PomodoroStats } from "@/components/PomodoroStats";
import { TaskList, useTaskState } from "@/components/TaskList";
import { ImagePlus, X } from "lucide-react";

function RealtimeClock({ iana }: { iana: string }) {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: iana,
        }),
      );
      setDate(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: iana,
        }),
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [iana]);

  const [h, m, s] = time.split(":");

  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex items-baseline gap-1 font-mono tracking-tight">
        <span className="text-5xl font-bold text-foreground">{h}</span>
        <span className="text-5xl font-bold text-foreground/30 animate-pulse">:</span>
        <span className="text-5xl font-bold text-foreground">{m}</span>
        <span className="text-5xl font-bold text-foreground/30 animate-pulse">:</span>
        <span className="text-5xl font-bold text-foreground">{s}</span>
      </div>
      <span className="mt-1 text-sm text-muted-foreground">{date}</span>
    </div>
  );
}

function BackgroundUploader({
  bgImage,
  onSet,
  onRemove,
}: {
  bgImage: string | null;
  onSet: (data: string) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image too large. Max 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onSet(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-300 hover:bg-secondary/80 hover:text-foreground"
      >
        <ImagePlus size={12} />
        {bgImage ? "Change BG" : "Set BG"}
      </button>
      {bgImage && (
        <button
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-secondary/50 text-muted-foreground transition-all duration-300 hover:bg-secondary/80 hover:text-foreground"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export default function Index() {
  const [iana, setIana] = useState(LOCATIONS[0].iana);
  const [bgImage, setBgImage] = useState<string | null>(() => {
    try { return localStorage.getItem("app-bg-image"); } catch { return null; }
  });
  const [weatherCode, setWeatherCode] = useState<number | undefined>(undefined);
  const timerRunning = useTimerRunning();

  const { tasks, setTasks, activeTaskId, setActiveTaskId, incrementPomodoro } = useTaskState();
  const activeTask = tasks.find((t) => t.id === activeTaskId);

  // Fetch weather code for current location
  useEffect(() => {
    const loc = LOCATIONS.find((l) => l.iana === iana) || LOCATIONS[0];
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=weather_code`)
      .then((r) => r.json())
      .then((d) => setWeatherCode(d.current?.weather_code))
      .catch(() => {});
  }, [iana]);

  const handleSetBg = (data: string) => {
    setBgImage(data);
    try { localStorage.setItem("app-bg-image", data); } catch { /* quota */ }
  };

  const handleRemoveBg = () => {
    setBgImage(null);
    localStorage.removeItem("app-bg-image");
  };

  const handleClearActiveTask = () => {
    // Reset in-progress task back to todo
    setTasks((prev) => prev.map((t) => (t.id === activeTaskId && t.status === "in-progress" ? { ...t, status: "todo" } : t)));
    setActiveTaskId(null);
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-start gap-6 p-8 bg-background"
      style={
        bgImage
          ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }
          : undefined
      }
    >
      {bgImage && <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />}

      <div className="relative z-10 flex flex-col items-center justify-center gap-6 w-full max-w-md">
        <div className="absolute top-0 left-0 flex items-center gap-2">
          <BackgroundUploader bgImage={bgImage} onSet={handleSetBg} onRemove={handleRemoveBg} />
        </div>
        <div className="absolute top-0 right-0">
          <ThemeToggle />
        </div>

        <div className="flex flex-col items-center gap-5 pt-10">
          <RealtimeClock iana={iana} />
          <LocationTag onLocationChange={setIana} />
        </div>

        <p className="text-sm text-muted-foreground my-0">
          Hover to reveal · Click to switch
        </p>

        <div className="w-full flex flex-col items-center gap-4">
          <PomodoroTimer
            activeTaskName={activeTask?.name}
            activeTaskId={activeTaskId}
            onClearActiveTask={handleClearActiveTask}
            onPomodoroComplete={incrementPomodoro}
          />
          <PomodoroStats />
        </div>

        {/* Task List */}
        <div className="w-full">
          <TaskList
            activeTaskId={activeTaskId}
            onActiveTaskChange={setActiveTaskId}
            tasks={tasks}
            onTasksChange={setTasks}
            timerRunning={timerRunning}
            weatherCode={weatherCode}
          />
        </div>
      </div>
    </div>
  );
}
