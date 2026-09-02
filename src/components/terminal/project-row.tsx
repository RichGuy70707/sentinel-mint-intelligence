import { ChainBadge, EligibilityBadge, StageBadge, StatusBadge } from "@/components/badges";
import { Countdown } from "@/components/countdown";
import type { ProjectModel } from "@/core/types";
import { evaluateProjectWallets, pickRelevantStage } from "@/eligibility/engine";
import { formatEth, formatInt } from "@/lib/format";
import { cn } from "@/lib/cn";
import { currentStage } from "@/stages/engine";
import { useHints } from "@/state/hints";
import { useWallets } from "@/state/wallets";

export function ProjectRow({
  project,
  selected,
  onSelect,
}: {
  project: ProjectModel;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const wallets = useWallets((s) => s.wallets);
  const hintMap = useHints((s) => s.byProject[project.id] ?? {});
  const stage = currentStage(project) ?? pickRelevantStage(project);
  const rows = evaluateProjectWallets(project, wallets, hintMap);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border-b border-line px-2 py-1.5 text-left",
        selected ? "bg-raised" : "hover:bg-raised/70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[12px] font-medium">{project.name}</div>
        <div className="shrink-0 text-[11px]">
          <Countdown startTime={stage?.startTime ?? null} endTime={stage?.endTime ?? null} />
        </div>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        <ChainBadge chain={project.chainKey} />
        <StatusBadge status={project.status} />
        {stage && <StageBadge kind={stage.kind} />}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-2.5 font-mono text-[10px] text-muted">
        <span>{formatEth(project.priceWei ?? stage?.priceWei)}</span>
        <span>
          {formatInt(project.minted)}
          {project.supply != null ? `/${formatInt(project.supply)}` : ""}
        </span>
        <span>{project.mintVelocityPerMin == null ? "—" : `${project.mintVelocityPerMin}/m`}</span>
      </div>
      {rows.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-x-2">
          {rows.slice(0, 4).map((r) => (
            <span key={r.walletId} className="inline-flex items-center gap-1 text-[10px] text-muted">
              {wallets.find((w) => w.id === r.walletId)?.name}
              <EligibilityBadge status={r.status} />
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
