import { useMemo } from "react";
import { CompactFilters } from "@/components/terminal/compact-filters";
import { ProjectPane } from "@/components/terminal/project-pane";
import { ProjectRow } from "@/components/terminal/project-row";
import { applyFilters, DEFAULT_FILTERS } from "@/core/filters";
import { boardEmptyCopy, compactChainErrors } from "@/core/terminal";
import type { ProjectModel } from "@/core/types";
import { evaluateProjectWallets } from "@/eligibility/engine";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useEligibilityHints } from "@/hooks/use-eligibility-hints";
import { catalogPhase, useCatalog } from "@/state/catalog";
import { useHints } from "@/state/hints";
import { useWallets } from "@/state/wallets";

export type BoardMode = "home" | "upcoming" | "trending" | "new" | "runners";

export function DiscoveryBoard({ mode }: { mode: BoardMode }) {
  const projects = useCatalog((s) => s.projects);
  const selectedId = useCatalog((s) => s.selectedId);
  const select = useCatalog((s) => s.select);
  const scanning = useCatalog((s) => s.scanning);
  const errors = useCatalog((s) => s.errors);
  const sessionFresh = useCatalog((s) => s.sessionFresh);
  const scanFailed = useCatalog((s) => s.scanFailed);
  const query = useCatalog((s) => s.query);
  const chainFilter = useCatalog((s) => s.chainFilter);
  const priceFilter = useCatalog((s) => s.priceFilter);
  const stageFilter = useCatalog((s) => s.stageFilter);
  const statusFilter = useCatalog((s) => s.statusFilter);
  const signals = useCatalog((s) => s.signals);
  const scannedAt = useCatalog((s) => s.scannedAt);
  const wallets = useWallets((s) => s.wallets);
  const hintStore = useHints((s) => s.byProject);
  useEligibilityHints();

  const { eligibleIds, readyIds, requiresIds, unknownIds } = useMemo(() => {
    const eligibleIds = new Set<string>();
    const readyIds = new Set<string>();
    const requiresIds = new Set<string>();
    const unknownIds = new Set<string>();
    for (const p of projects) {
      const rows = evaluateProjectWallets(p, wallets, hintStore[p.id] ?? {});
      if (rows.some((r) => r.status === "ELIGIBLE")) eligibleIds.add(p.id);
      if (rows.some((r) => r.status === "ELIGIBLE" && !r.requiresVerification)) readyIds.add(p.id);
      if (rows.some((r) => r.status === "REQUIRES_PROOF" || r.status === "REQUIRES_VERIFICATION")) requiresIds.add(p.id);
      if (rows.some((r) => r.status === "UNKNOWN")) unknownIds.add(p.id);
    }
    return { eligibleIds, readyIds, requiresIds, unknownIds };
  }, [projects, wallets, hintStore]);

  const filtered = useMemo(
    () =>
      applyFilters(projects, {
        ...DEFAULT_FILTERS,
        query,
        chain: chainFilter,
        price: priceFilter,
        stage: stageFilter,
        status: statusFilter,
        myEligible: signals.myEligible,
        readyToMint: signals.readyToMint,
        requiresVerification: signals.requiresVerification,
        unknownEligibility: signals.unknownEligibility,
        eligibleIds,
        readyIds,
        requiresVerificationIds: requiresIds,
        unknownEligibilityIds: unknownIds,
      }),
    [projects, query, chainFilter, priceFilter, stageFilter, statusFilter, signals, eligibleIds, readyIds, requiresIds, unknownIds],
  );

  const left = useMemo(() => sortForMode(filtered, mode), [filtered, mode]);
  const selected = left.find((p) => p.id === selectedId) ?? left[0] ?? null;
  const trending = [...filtered].sort((a, b) => (b.mintVelocityPerMin ?? -1) - (a.mintVelocityPerMin ?? -1)).slice(0, 10);
  const fresh = [...filtered].sort((a, b) => (b.detectedAt ?? 0) - (a.detectedAt ?? 0)).slice(0, 10);
  const runners = [...filtered]
    .sort((a, b) => runnerScore(b) - runnerScore(a))
    .slice(0, 10);
  const mintPerSec = velocityPerSec(filtered);
  const phase = catalogPhase({ scanning, sessionFresh, scanFailed, projects, errors });
  const degraded = phase === "DEGRADED" || phase === "ERROR" ? compactChainErrors(errors) : null;

  return (
    <div className="grid min-h-[calc(100vh-40px)] lg:grid-cols-[272px_minmax(0,1fr)_248px]">
      <section className="flex min-h-0 flex-col border-r border-line">
        <RailHeader title={leftTitle(mode)} count={left.length} scanning={scanning} extra={degraded} />
        <CompactFilters />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {left.length === 0 ? (
            <p className="px-3 py-6 text-xs text-muted">
              {boardEmptyCopy(phase)}
            </p>
          ) : (
            left.map((p) => (
              <ProjectRow key={p.id} project={p} selected={selected?.id === p.id} onSelect={() => select(p.id)} />
            ))
          )}
        </div>
      </section>
      <section className="min-w-0 border-r border-line">
        <ProjectPane project={selected} />
      </section>
      <aside className="hidden min-h-0 overflow-y-auto lg:block">
        <RailHeader title="Trending" count={trending.length} scanning={scanning} />
        {trending.length === 0 ? (
          <p className="px-2 py-2 text-[11px] text-subtle">Waiting for velocity…</p>
        ) : (
          trending.map((p) => (
            <Mini
              key={`t-${p.id}`}
              name={p.name}
              meta={p.mintVelocityPerMin == null ? "—" : `${fmtVel(p.mintVelocityPerMin)}/m`}
              active={selected?.id === p.id}
              onClick={() => select(p.id)}
            />
          ))
        )}
        <RailHeader title="New Mints" count={fresh.length} scanning={scanning} />
        <p className="border-b border-line px-2 py-0.5 font-mono text-[10px] text-subtle">
          {mintPerSec} MINT/S · {scannedAt ? "POLL 20s" : "—"}
        </p>
        {fresh.length === 0 ? (
          <p className="px-2 py-2 text-[11px] text-subtle">Waiting for new mints...</p>
        ) : (
          fresh.map((p) => (
            <Mini
              key={`n-${p.id}`}
              name={p.name}
              meta={p.chainKey.toUpperCase()}
              active={selected?.id === p.id}
              onClick={() => select(p.id)}
            />
          ))
        )}
        <RailHeader title="Runners" count={runners.length} scanning={scanning} />
        <div className="grid grid-cols-[minmax(0,1fr)_40px_40px_32px] border-b border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-subtle">
          <span>Project</span>
          <span>Vol</span>
          <span>Flr</span>
          <span>Sls</span>
        </div>
        {runners.length === 0 ? (
          <p className="px-2 py-2 text-[11px] text-subtle">No high-activity collections yet.</p>
        ) : (
          runners.map((p) => (
            <button
              key={`r-${p.id}`}
              type="button"
              onClick={() => select(p.id)}
              className={cn(
                "grid w-full grid-cols-[minmax(0,1fr)_40px_40px_32px] items-center border-b border-line px-2 py-1 text-left hover:bg-raised",
                selected?.id === p.id && "bg-raised",
              )}
            >
              <span className="truncate text-[11px]">{p.name}</span>
              <span className="font-mono text-[10px] text-muted">{formatMarket(p.market?.volumeWei)}</span>
              <span className="font-mono text-[10px] text-muted">{formatMarket(p.market?.floorWei)}</span>
              <span className="font-mono text-[10px] text-muted">{p.market?.sales ?? "—"}</span>
            </button>
          ))
        )}
      </aside>
    </div>
  );
}

function leftTitle(mode: BoardMode): string {
  if (mode === "upcoming") return "Upcoming Mints";
  if (mode === "trending") return "Trending";
  if (mode === "new") return "New Mints";
  if (mode === "runners") return "Runners";
  return "Upcoming Mints";
}

function sortForMode(projects: ProjectModel[], mode: BoardMode): ProjectModel[] {
  const copy = [...projects];
  if (mode === "upcoming") {
    return copy.sort((a, b) => statusRank(a.status) - statusRank(b.status) || (b.detectedAt ?? 0) - (a.detectedAt ?? 0));
  }
  if (mode === "trending") return copy.sort((a, b) => (b.mintVelocityPerMin ?? 0) - (a.mintVelocityPerMin ?? 0));
  if (mode === "new") return copy.sort((a, b) => (b.detectedAt ?? 0) - (a.detectedAt ?? 0));
  if (mode === "runners") return copy.sort((a, b) => runnerScore(b) - runnerScore(a));
  return copy.sort((a, b) => statusRank(a.status) - statusRank(b.status) || (b.mintVelocityPerMin ?? 0) - (a.mintVelocityPerMin ?? 0));
}

function statusRank(status: ProjectModel["status"]): number {
  if (status === "LIVE") return 0;
  if (status === "UPCOMING") return 1;
  if (status === "UNKNOWN") return 2;
  return 3;
}

function runnerScore(p: ProjectModel): number {
  return (p.mintVelocityPerMin ?? 0) * (p.uniqueMinters ?? 0);
}

function velocityPerSec(projects: ProjectModel[]): string {
  const perMin = projects.reduce((sum, p) => sum + (p.mintVelocityPerMin ?? 0), 0);
  return (perMin / 60).toFixed(1);
}

function fmtVel(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function formatMarket(wei: string | null | undefined): string {
  if (wei == null) return "—";
  try {
    const n = Number(wei) / 1e18;
    if (!Number.isFinite(n)) return "—";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    if (n >= 10) return n.toFixed(1);
    return n.toFixed(2);
  } catch {
    return "—";
  }
}

function RailHeader({
  title,
  count,
  scanning,
  extra,
}: {
  title: string;
  count: number;
  scanning: boolean;
  extra?: string | null;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line px-2 py-1">
      <h2 className="text-[10px] uppercase tracking-[0.14em] text-subtle">{title}</h2>
      <span className="font-mono text-[10px] text-muted">
        {scanning ? "…" : formatInt(count)}
        {extra ? <span className="ml-2 text-warn">{extra}</span> : null}
      </span>
    </div>
  );
}

function Mini({
  name,
  meta,
  onClick,
  active,
}: {
  name: string;
  meta: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between border-b border-line px-2 py-1 text-left hover:bg-raised",
        active && "bg-raised",
      )}
    >
      <span className="truncate text-[11px]">{name}</span>
      <span className="font-mono text-[10px] text-muted">{meta}</span>
    </button>
  );
}
