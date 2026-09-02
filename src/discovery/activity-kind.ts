export type ActivityKind = "NORMAL" | "BULK" | "UNKNOWN";

export function classifyActivity(input: {
  windowMints: number | null;
  uniqueMinters: number | null;
  mintTxCount: number | null;
}): ActivityKind {
  const qty = input.windowMints;
  const minters = input.uniqueMinters;
  const txs = input.mintTxCount;
  if (qty == null || qty <= 0) return "UNKNOWN";
  if (txs != null && txs <= 0) return "UNKNOWN";
  if (txs === 1 && qty >= 20) return "BULK";
  if (minters === 1 && qty >= 20) return "BULK";
  if (txs != null && txs > 0 && qty / txs >= 20) return "BULK";
  if (minters != null && minters > 0 && qty / minters >= 50) return "BULK";
  return "NORMAL";
}

export function trendScore(input: {
  velocity: number | null;
  uniqueMinters: number | null;
  activityKind?: ActivityKind | null;
}): number {
  if (input.velocity == null) return -1;
  const minters = Math.max(1, input.uniqueMinters ?? 1);
  if (input.activityKind === "BULK") return input.velocity * 0.05 * minters;
  return input.velocity * minters;
}
