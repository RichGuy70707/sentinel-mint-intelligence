export function mintLogKey(input: {
  transactionHash?: string | null;
  address?: string | null;
  topics?: string[] | null;
}): string {
  const tx = (input.transactionHash ?? "").toLowerCase();
  const addr = (input.address ?? "").toLowerCase();
  const topics = (input.topics ?? []).join(",");
  return `${tx}:${addr}:${topics}`;
}

export function dedupeMintLogs<T extends { transactionHash?: string | null; address?: string | null; topics?: string[] | null }>(
  logs: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const log of logs) {
    const key = mintLogKey(log);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(log);
  }
  return out;
}

export function velocityPerMin(mints: number, windowMinutes: number | null): number | null {
  if (windowMinutes == null || windowMinutes <= 0) return null;
  if (mints <= 0) return 0;
  return Number((mints / windowMinutes).toFixed(2));
}

export function saneSupply(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  if (value > 50_000_000) return null;
  return Math.floor(value);
}
