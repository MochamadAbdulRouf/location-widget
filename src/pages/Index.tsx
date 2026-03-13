import { LocationTag } from "@/components/ui/location-tag";

export default function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8">
      <div className="flex flex-col items-center gap-3">
        <LocationTag />
        <p className="text-sm text-muted-foreground">Hover to reveal</p>
      </div>

      <hr className="w-24 border-border" />

      <p className="text-sm text-muted-foreground">
        A minimal location indicator with live time
      </p>
    </div>
  );
}
