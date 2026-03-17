import { useState, useEffect, useRef } from "react";
import { LocationTag, LOCATIONS } from "@/components/ui/location-tag";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PomodoroTimer } from "@/components/PomodoroTimer";
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

function BackgroundUploader({ bgImage, onSet, onRemove }: { bgImage: string | null; onSet: (data: string) => void; onRemove: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limit to ~5MB for localStorage
    if (file.size > 5 * 1024 * 1024) {
      alert("Image too large. Max 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onSet(result);
    };
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

  const handleSetBg = (data: string) => {
    setBgImage(data);
    try { localStorage.setItem("app-bg-image", data); } catch { /* quota exceeded */ }
  };

  const handleRemoveBg = () => {
    setBgImage(null);
    localStorage.removeItem("app-bg-image");
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center gap-8 p-8 bg-background"
      style={bgImage ? {
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      } : undefined}
    >
      {/* Overlay for readability when bg image is set */}
      {bgImage && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      )}

      <div className="relative z-10 flex flex-col items-center justify-center gap-8 w-full">
        <div className="absolute top-0 right-0 flex items-center gap-2">
          <BackgroundUploader bgImage={bgImage} onSet={handleSetBg} onRemove={handleRemoveBg} />
          <ThemeToggle />
        </div>

        <div className="flex flex-col items-center gap-5">
          <RealtimeClock iana={iana} />
          <LocationTag onLocationChange={setIana} />
        </div>

        <p className="text-sm text-muted-foreground">
          Hover to reveal · Click to switch
        </p>

        <div className="mt-4">
          <PomodoroTimer />
        </div>
      </div>
    </div>
  );
}
