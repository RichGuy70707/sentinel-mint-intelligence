import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChainBadge, EligibilityBadge, StageBadge, StatusBadge } from "@/components/badges";
import { Countdown } from "@/components/countdown";
import { Button, Input } from "@/components/ui/primitives";
import { shortAddress } from "@/core/address";
import { formatWhen } from "@/core/time";
import { nextHintMap } from "@/core/terminal";
import type { ProjectModel } from "@/core/types";
import { evaluateProjectWallets, pickRelevantStage, type OnChainHints } from "@/eligibility/engine";
import { formatEth, formatInt } from "@/lib/format";
import { inspectProjectFn, prepareMintFn, simulateMintFn, walletHintsFn } from "@/server/functions";
import { currentStage, nextStage, stagePhase } from "@/stages/engine";
import { useAlerts } from "@/state/alerts";
import { useCatalog } from "@/state/catalog";
import { useHints } from "@/state/hints";
import { useQueue } from "@/state/queue";
import { useWallets } from "@/state/wallets";

const EMPTY_HINTS: Record<string, OnChainHints> = {};

export function ProjectPane({ project }: { project: ProjectModel | null }) {
  const wallets = useWallets((s) => s.wallets);
  const upsert = useCatalog((s) => s.upsert);
  const upsertQueue = useQueue((s) => s.upsert);
  const push = useAlerts((s) => s.push);
  const storedHints = useHints((s) => (project ? s.byProject[project.id] : undefined));
  const [qty, setQty] = useState(1);
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [hints, setHints] = useState<Record<string, OnChainHints>>({});

  const projectId = project?.id ?? "";
  const contract = project?.contract ?? "";
  const chainKey = project?.chainKey;
  const walletKey = wallets.map((w) => `${w.id}:${w.address.toLowerCase()}`).join("|");

  useEffect(() => {
    if (!walletId && wallets[0]) setWalletId(wallets[0].id);
  }, [wallets, walletId]);

  useEffect(() => {
    const clear = !projectId || !contract || !chainKey || walletKey.length === 0;
    if (clear) {
      setHints((prev) => nextHintMap(prev, {}, true));
      return;
    }
    let cancelled = false;
    const snapshot = walletKey;
    const pairs = snapshot.split("|").map((row) => {
      const cut = row.indexOf(":");
      return { id: row.slice(0, cut), address: row.slice(cut + 1) };
    });
    walletHintsFn({
      data: {
        chainKey,
        contract,
        wallets: pairs.map((p) => p.address),
      },
    })
      .then((rows) => {
        if (cancelled) return;
        const next: Record<string, OnChainHints> = {};
        for (const pair of pairs) {
          const row = rows.find((r) => r.address.toLowerCase() === pair.address);
          if (row) {
            next[pair.id] = {
              nftBalance: row.nftBalance ?? undefined,
              nativeBalanceWei: row.nativeBalanceWei ?? undefined,
              gateTokenBalance: row.gateTokenBalance ?? undefined,
            };
          }
        }
        setHints((prev) => nextHintMap(prev, next, false));
        useHints.getState().setProjectHints(projectId, next);
      })
      .catch(() => {
        if (!cancelled) setHints((prev) => nextHintMap(prev, {}, true));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, contract, chainKey, walletKey]);

  const hintMap = Object.keys(hints).length ? hints : (storedHints ?? EMPTY_HINTS);
  const evs = useMemo(
    () => (project ? evaluateProjectWallets(project, wallets, hintMap) : []),
    [project, wallets, hintMap],
  );

  if (!project) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-muted">Select a project to view details</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-subtle">
          Mint progress · Deployer · Market · Contract
        </p>
      </div>
    );
  }

  const live = currentStage(project);
  const nxt = nextStage(project);
  const stage = live ?? pickRelevantStage(project);
  const wallet = wallets.find((w) => w.id === walletId);
  const minted = project.minted;
  const supply = project.supply;
  const pct = minted != null && supply ? Math.min(100, Math.round((minted / supply) * 100)) : null;

  async function refresh() {
    if (!project?.contract) return;
    setBusy("refresh");
    try {
      upsert(await inspectProjectFn({ data: { chainKey: project.chainKey, address: project.contract } }));
    } finally {
      setBusy(null);
    }
  }

  async function prep() {
    if (!project?.contract || !wallet) {
      setNote("Select a named wallet first.");
      return;
    }
    setBusy("sim");
    try {
      const prepared = await prepareMintFn({
        data: {
          chainKey: project.chainKey,
          contract: project.contract,
          wallet: wallet.address,
          quantity: qty,
          priceWeiPerMint: project.priceWei ?? stage?.priceWei ?? null,
        },
      });
      if (!prepared.ok) {
        upsertQueue({
          projectId: project.id,
          walletId: wallet.id,
          stageId: stage?.id ?? "unknown",
          quantity: qty,
          preparedTx: null,
          simulation: null,
          status: "PREPARATION_FAILED",
          txHash: null,
          chainKey: project.chainKey,
        });
        setNote(`${prepared.code}: ${prepared.reason}`);
        return;
      }
      const sim = await simulateMintFn({ data: { chainKey: project.chainKey, tx: prepared.tx } });
      upsertQueue({
        projectId: project.id,
        walletId: wallet.id,
        stageId: stage?.id ?? "unknown",
        quantity: qty,
        preparedTx: prepared.tx,
        simulation: sim,
        status: sim.status === "READY" ? "READY" : sim.status === "SIMULATION_FAILED" ? "SIMULATION_FAILED" : "SIMULATED",
        txHash: null,
        chainKey: project.chainKey,
      });
      setNote(`${sim.kind}: ${sim.explanation}`);
      if (sim.status === "READY") push("TX_READY", "Simulation ready", `${project.name} / ${wallet.name}`);
      if (sim.status === "SIMULATION_FAILED") push("SIMULATION_FAILURE", "Simulation failed", sim.explanation);
      if (sim.status === "INSUFFICIENT_FUNDS") push("INSUFFICIENT_FUNDS", "Insufficient funds", wallet.name);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Prepare failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex items-start justify-between gap-3 border-b border-line px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {project.imageUrl ? (
              <img
                src={project.imageUrl}
                alt=""
                className="h-5 w-5 shrink-0 rounded-sm bg-raised object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span className="h-5 w-5 shrink-0 rounded-sm bg-raised" aria-hidden />
            )}
            <h2 className="truncate text-base font-medium tracking-tight">{project.name}</h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <ChainBadge chain={project.chainKey} />
            <StatusBadge status={project.status} />
            {stage && <StageBadge kind={stage.kind} />}
            <span className="font-mono text-[10px] text-muted">{project.symbol}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[9px] uppercase tracking-[0.14em] text-subtle">
            {live ? "Remaining" : nxt ? "Starts" : "Clock"}
          </div>
          <div className="font-mono text-xl leading-none">
            <Countdown startTime={stage?.startTime ?? nxt?.startTime ?? null} endTime={stage?.endTime ?? nxt?.endTime ?? null} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-px border-b border-line bg-line">
        <Metric label="Price" value={formatEth(project.priceWei ?? stage?.priceWei)} />
        <Metric label="Minted" value={formatInt(minted)} />
        <Metric
          label="Activity"
          value={project.windowMints == null ? "—" : `+${formatInt(project.windowMints)}`}
        />
        <Metric label="Vel" value={project.mintVelocityPerMin == null ? "—" : `${project.mintVelocityPerMin}/m`} />
        <Metric label="Unique" value={formatInt(project.uniqueMinters)} />
      </div>

      {pct != null && (
        <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
          <span className="text-[9px] uppercase tracking-[0.12em] text-subtle">Progress</span>
          <div className="h-1 flex-1 bg-raised">
            <div className="h-1 bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-[10px] text-muted">{pct}%</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-line px-3 py-2 text-[11px] sm:grid-cols-3">
        <KV k="Contract" v={project.contract ? shortAddress(project.contract, 5) : "UNKNOWN"} href={project.links[0]?.href} />
        <KV k="Deployer" v={project.deployer ? shortAddress(project.deployer, 5) : "UNKNOWN"} />
        <KV k="Type" v={project.contractType ?? "UNKNOWN"} />
        <KV k="Mint" v={project.mintMethod ?? "UNKNOWN"} />
        <KV k="Stage" v={stage ? `${stage.label} · ${stagePhase(stage)}` : "UNKNOWN"} />
        <KV k="Window" v={`${formatWhen(stage?.startTime ?? null)} → ${formatWhen(stage?.endTime ?? null)}`} />
        <KV k="Cap" v={supply != null ? formatInt(supply) : "UNKNOWN"} />
        <KV k="Activity" v={project.windowMints != null ? `+${formatInt(project.windowMints)}` : "—"} />
        <KV k="Txs" v={project.mintTxCount != null ? formatInt(project.mintTxCount) : "—"} />
        <KV k="Signal" v={project.activityKind ?? "UNKNOWN"} />
      </div>

      <div className="grid grid-cols-3 gap-x-4 border-b border-line px-3 py-2 text-[11px]">
        <KV k="Floor" v={project.market?.floorWei != null ? formatEth(project.market.floorWei) : "UNKNOWN"} />
        <KV k="Volume" v={project.market?.volumeWei != null ? formatEth(project.market.volumeWei) : "UNKNOWN"} />
        <KV k="Sales" v={project.market?.sales != null ? formatInt(project.market.sales) : "UNKNOWN"} />
      </div>

      <div className="border-b border-line px-3 py-2">
        <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-subtle">Wallets</div>
        {wallets.length === 0 ? (
          <p className="text-[11px] text-muted">
            Add wallets in <Link to="/wallets" className="underline">Wallet Center</Link>.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {evs.map((r) => (
              <li key={r.walletId} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate">
                  {wallets.find((w) => w.id === r.walletId)?.name}
                  <span className="ml-2 text-[10px] text-muted">{r.reason}</span>
                </span>
                <EligibilityBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {project.riskFlags.length > 0 && (
        <div className="border-b border-line px-3 py-1.5 font-mono text-[10px] text-subtle">
          {project.riskFlags.slice(0, 3).join(" · ")}
        </div>
      )}

      <div className="px-3 py-2">
        <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-subtle">Prepare</div>
        <div className="grid grid-cols-[1fr_56px_auto] gap-1.5">
          <select
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            className="h-8 border border-line bg-bg px-2 text-[11px]"
          >
            <option value="">Wallet</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <Input type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="h-8" />
          <Button className="h-8 px-3 text-[12px]" onClick={() => void prep()} disabled={busy === "sim"}>
            {busy === "sim" ? "Sim…" : "Prepare"}
          </Button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px]">
          <button type="button" className="text-muted hover:text-fg" onClick={() => void refresh()} disabled={busy === "refresh"}>
            {busy === "refresh" ? "Inspecting…" : "Re-inspect"}
          </button>
          <Link to="/projects/$id" params={{ id: encodeURIComponent(project.id) }} className="text-muted hover:text-fg">
            Full project
          </Link>
          <Link to="/execution" className="text-muted hover:text-fg">
            Execution
          </Link>
        </div>
        {note && <p className="mt-1 text-[11px] text-muted">{note}</p>}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.12em] text-subtle">{label}</div>
      <div className="truncate font-mono text-[12px]">{value}</div>
    </div>
  );
}

function KV({ k, v, href }: { k: string; v: string; href?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-[0.12em] text-subtle">{k}</div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="block truncate font-mono text-accent">
          {v}
        </a>
      ) : (
        <div className="truncate font-mono">{v}</div>
      )}
    </div>
  );
}
