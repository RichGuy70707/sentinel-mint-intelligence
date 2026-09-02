import { Link } from "@tanstack/react-router";
import { ChainBadge, StageBadge, StatusBadge } from "@/components/badges";
import { Countdown } from "@/components/countdown";
import { currentStage, nextStage } from "@/stages/engine";
import { formatEth, formatInt } from "@/lib/format";
import type { ProjectModel } from "@/core/types";
import { shortAddress } from "@/core/address";

export function MintCard({ project }: { project: ProjectModel }) {
  const live = currentStage(project);
  const next = nextStage(project);
  const stage = live ?? next;
  return (
    <Link
      to="/projects/$id"
      params={{ id: encodeURIComponent(project.id) }}
      className="block border border-line bg-surface p-3 transition-colors duration-150 hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium">{project.name}</h3>
            <span className="font-mono text-[11px] text-subtle">{project.symbol}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ChainBadge chain={project.chainKey} />
            <StatusBadge status={project.status} />
            <StageBadge kind={live?.kind ?? next?.kind ?? "UNKNOWN"} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.12em] text-subtle">{live ? "Remaining" : "Starts"}</div>
          <div className="mt-1 text-sm">
            <Countdown startTime={stage?.startTime ?? null} endTime={stage?.endTime ?? null} />
          </div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
        <Stat label="Price" value={formatEth(project.priceWei ?? live?.priceWei ?? null)} />
        <Stat label="Minted" value={formatInt(project.minted)} />
        <Stat label="Velocity" value={project.mintVelocityPerMin == null ? "—" : `${project.mintVelocityPerMin}/m`} />
        <Stat label="Contract" value={project.contract ? shortAddress(project.contract) : "UNKNOWN"} />
      </dl>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-subtle">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
