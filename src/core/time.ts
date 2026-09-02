export function nowMs(): number {
  return Date.now();
}

export function clampNonNegative(n: number): number {
  return n < 0 ? 0 : n;
}

/** Earliest plausible NFT-era timestamp (2020-01-01). */
const MIN_MS = Date.UTC(2020, 0, 1);
const MAX_MS = Date.UTC(2100, 0, 1);

export function normalizeTimestamp(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  let ms = value;
  if (ms < 1e12) {
    if (ms < 1e9) return null;
    ms = Math.floor(ms * 1000);
  }
  if (ms < MIN_MS || ms > MAX_MS) return null;
  return Math.floor(ms);
}

export function remainingMs(target: number | null | undefined, now = nowMs()): number | null {
  const ts = normalizeTimestamp(target);
  if (ts == null) return null;
  return ts - now;
}

export type ClockKind = "future" | "active" | "ended" | "unknown";

export function formatCountdown(ms: number | null): string {
  if (ms == null) return "—";
  if (ms <= 0) return "ENDED";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (d > 0) return `${d}d ${hh}:${mm}:${ss}`;
  return `${hh}:${mm}:${ss}`;
}

export function stageClock(
  startTime: number | null | undefined,
  endTime: number | null | undefined,
  now = nowMs(),
): { text: string; kind: ClockKind } {
  const start = normalizeTimestamp(startTime);
  const end = normalizeTimestamp(endTime);
  if (start == null && end == null) return { text: "—", kind: "unknown" };
  if (end != null && end <= now) return { text: "ENDED", kind: "ended" };
  if (start != null && start > now) return { text: formatCountdown(start - now), kind: "future" };
  if (end != null && end > now) return { text: formatCountdown(end - now), kind: "active" };
  if (start != null && start <= now && end == null) return { text: "LIVE", kind: "active" };
  return { text: "—", kind: "unknown" };
}

export function formatWhen(ts: number | null | undefined): string {
  const n = normalizeTimestamp(ts);
  if (n == null) return "UNKNOWN";
  return new Date(n).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isFresh(fetchedAt: number, ttlMs: number, now = nowMs()): boolean {
  return now - fetchedAt <= ttlMs;
}

export function windowLabel(start: number | null, now = nowMs()): string {
  const ts = normalizeTimestamp(start);
  if (ts == null) return "Upcoming";
  const delta = ts - now;
  if (delta <= 0) return "Minting Now";
  if (delta <= 60 * 60 * 1000) return "Next Hour";
  const startDay = new Date(ts);
  const today = new Date(now);
  if (sameDay(startDay, today)) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(startDay, tomorrow)) return "Tomorrow";
  return "Upcoming";
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function classifyMintStatus(
  stages: { startTime: number | null; endTime: number | null }[],
  now = nowMs(),
): "UPCOMING" | "LIVE" | "ENDED" | "UNKNOWN" {
  if (stages.length === 0) return "UNKNOWN";
  const normalized = stages.map((s) => ({
    startTime: normalizeTimestamp(s.startTime),
    endTime: normalizeTimestamp(s.endTime),
  }));
  const starts = normalized.map((s) => s.startTime).filter((n): n is number => n != null);
  const ends = normalized.map((s) => s.endTime).filter((n): n is number => n != null);
  const anyLive = normalized.some((s) => {
    const started = s.startTime != null && s.startTime <= now;
    const notEnded = s.endTime == null || s.endTime > now;
    return started && notEnded;
  });
  if (anyLive) return "LIVE";
  if (starts.length && Math.min(...starts) > now) return "UPCOMING";
  if (ends.length && starts.length && Math.max(...ends) < now && Math.max(...starts) < now) return "ENDED";
  if (starts.length && Math.min(...starts) <= now && (!ends.length || Math.max(...ends) >= now)) return "LIVE";
  return "UNKNOWN";
}

export function activeStageIndex(
  stages: { startTime: number | null; endTime: number | null }[],
  now = nowMs(),
): number {
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i]!;
    const start = normalizeTimestamp(s.startTime);
    const end = normalizeTimestamp(s.endTime);
    const started = start != null && start <= now;
    const notEnded = end == null || end > now;
    if (started && notEnded) return i;
  }
  return stages.findIndex((s) => {
    const start = normalizeTimestamp(s.startTime);
    return start != null && start > now;
  });
}
