import { useState, useEffect } from "react";
import { LocationTag, LOCATIONS } from "@/components/ui/location-tag";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PomodoroTimer } from "@/components/PomodoroTimer";

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
        })
      );
      setDate(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: iana,
        })
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

export default function Index() {
  const [iana, setIana] = useState(LOCATIONS[0].iana);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center gap-5">
        <RealtimeClock iana={iana} />
        <LocationTag onLocationChange={setIana} />
      </div>

      <p className="text-sm text-muted-foreground">
        Hover to reveal · Click to switch
      </p>
    </div>
  );
}
