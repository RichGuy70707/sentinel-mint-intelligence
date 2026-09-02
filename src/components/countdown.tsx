import { useEffect, useState } from "react";
import { stageClock, type ClockKind } from "@/core/time";
import { cn } from "@/lib/cn";

export function Countdown({ startTime = null, endTime = null }: { startTime?: number | null; endTime?: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const clock = stageClock(startTime, endTime, now);
  return <span className={cn("font-mono tabular", tone(clock.kind))}>{clock.text}</span>;
}

function tone(kind: ClockKind): string {
  if (kind === "active") return "text-live";
  if (kind === "future") return "text-fg";
  if (kind === "ended") return "text-muted";
  return "text-subtle";
}
