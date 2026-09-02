import { CHAINS } from "@/chains/registry";
import type { ChainKey, EligibilityStatus, MintStatus, ReadinessStatus, StageKind } from "@/core/types";
import { cn } from "@/lib/cn";

export function ChainBadge({ chain }: { chain: ChainKey }) {
  const c = CHAINS[chain];
  return (
    <span className="inline-flex items-center rounded-sm border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted">
      {c?.shortName ?? chain.toUpperCase()}
    </span>
  );
}

export function StatusBadge({ status }: { status: MintStatus }) {
  const map: Record<MintStatus, string> = {
    LIVE: "text-live border-live/30",
    UPCOMING: "text-info border-info/30",
    ENDED: "text-muted border-line",
    UNKNOWN: "text-warn border-warn/30",
  };
  return <span className={cn("inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-medium", map[status])}>{status}</span>;
}

export function StageBadge({ kind }: { kind: StageKind }) {
  return (
    <span className="inline-flex rounded-sm border border-line bg-bg px-1.5 py-0.5 text-[10px] font-medium text-accent">
      {kind.replaceAll("_", " ")}
    </span>
  );
}

export function EligibilityBadge({ status }: { status: EligibilityStatus }) {
  const tone =
    status === "ELIGIBLE"
      ? "text-live border-live/30"
      : status === "NOT_ELIGIBLE" || status === "ENDED"
        ? "text-danger border-danger/30"
        : status === "REQUIRES_PROOF" || status === "REQUIRES_VERIFICATION"
          ? "text-warn border-warn/30"
          : "text-muted border-line";
  return <span className={cn("inline-flex rounded-sm border px-1.5 py-0.5 text-[10px]", tone)}>{status.replaceAll("_", " ")}</span>;
}

export function ReadyBadge({ status }: { status: ReadinessStatus }) {
  const tone =
    status === "READY"
      ? "text-live border-live/30"
      : status === "INSUFFICIENT_FUNDS" || status === "SIMULATION_FAILED"
        ? "text-danger border-danger/30"
        : "text-warn border-warn/30";
  return <span className={cn("inline-flex rounded-sm border px-1.5 py-0.5 text-[10px]", tone)}>{status.replaceAll("_", " ")}</span>;
}
