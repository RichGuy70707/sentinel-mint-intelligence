import { formatEther } from "viem";

export function formatEth(wei: string | null | undefined): string {
  if (wei == null) return "Unknown";
  try {
    const v = formatEther(BigInt(wei));
    if (v === "0") return "Free";
    const n = Number(v);
    if (!Number.isFinite(n)) return `${v} ETH`;
    return `${n.toPrecision(4)} ETH`;
  } catch {
    return "UNKNOWN";
  }
}

export function formatInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat().format(n);
}
