import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChainBadge, EligibilityBadge, StageBadge, StatusBadge } from "@/components/badges";
import { Countdown } from "@/components/countdown";
import { EmptyState, Page, PageHeader } from "@/components/page";
import { Button, Input } from "@/components/ui/primitives";
import { shortAddress } from "@/core/address";
import { formatWhen } from "@/core/time";
import { evaluateProjectWallets, pickRelevantStage } from "@/eligibility/engine";
import { formatEth, formatInt } from "@/lib/format";
import { inspectProjectFn, prepareMintFn, simulateMintFn } from "@/server/functions";
import { currentStage, nextStage, stagePhase } from "@/stages/engine";
import { useAlerts } from "@/state/alerts";
import { useCatalog } from "@/state/catalog";
import { useQueue } from "@/state/queue";
import { useWallets } from "@/state/wallets";

export const Route = createFileRoute("/projects/$id")({ component: ProjectDetail });

function ProjectDetail() {
  const { id } = Route.useParams();
  const decoded = decodeURIComponent(id);
  const project = useCatalog((s) => s.projects.find((p) => p.id === decoded));
  const upsert = useCatalog((s) => s.upsert);
  const wallets = useWallets((s) => s.wallets);
  const upsertQueue = useQueue((s) => s.upsert);
  const push = useAlerts((s) => s.push);
  const [qty, setQty] = useState(1);
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const rows = useMemo(() => (project ? evaluateProjectWallets(project, wallets) : []), [project, wallets]);
  const live = project ? currentStage(project) : null;
  const nxt = project ? nextStage(project) : null;

  if (!project) {
    return (
      <Page>
        <EmptyState title="Project not in session memory" body="Return to Projects and inspect the contract again." />
      </Page>
    );
  }

  const wallet = wallets.find((w) => w.id === walletId);

  async function refresh() {
    if (!project?.contract) return;
    setBusy("refresh");
    try {
      const next = await inspectProjectFn({ data: { chainKey: project.chainKey, address: project.contract } });
      upsert(next);
    } finally {
      setBusy(null);
    }
  }

  async function prepareAndSim() {
    if (!project?.contract || !wallet) {
      setNote("Select a wallet and ensure the project has a contract.");
      return;
    }
    setBusy("sim");
    setNote(null);
    try {
      const prepared = await prepareMintFn({
        data: {
          chainKey: project.chainKey,
          contract: project.contract,
          wallet: wallet.address,
          quantity: qty,
          priceWeiPerMint: project.priceWei ?? live?.priceWei ?? null,
        },
      });
      if (!prepared.ok) {
        upsertQueue({
          projectId: project.id,
          walletId: wallet.id,
          stageId: pickRelevantStage(project)?.id ?? "unknown",
          quantity: qty,
          preparedTx: null,
          simulation: null,
          status: "PREPARATION_FAILED",
          txHash: null,
        });
        setNote(`${prepared.code}: ${prepared.reason}`);
        return;
      }
      const sim = await simulateMintFn({ data: { chainKey: project.chainKey, tx: prepared.tx } });
      upsertQueue({
        projectId: project.id,
        walletId: wallet.id,
        stageId: pickRelevantStage(project)?.id ?? "unknown",
        quantity: qty,
        preparedTx: prepared.tx,
        simulation: sim,
        status: sim.status === "READY" ? "READY" : sim.status === "SIMULATION_FAILED" ? "SIMULATION_FAILED" : "SIMULATED",
        txHash: null,
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
    <Page>
      <PageHeader
        kicker="Project"
        title={project.name}
        actions={
          <Button variant="ghost" onClick={() => void refresh()} disabled={busy === "refresh"}>
            Re-inspect
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <ChainBadge chain={project.chainKey} />
        <StatusBadge status={project.status} />
        <StageBadge kind={live?.kind ?? nxt?.kind ?? "UNKNOWN"} />
        <span className="font-mono text-[12px] text-muted">{project.symbol}</span>
      </div>

      <section className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-line bg-surface p-4">
          <h2 className="text-sm font-medium">Overview</h2>
          <p className="mt-2 text-sm text-muted">{project.description}</p>
          <dl className="mt-4 space-y-2 text-[13px]">
            <Row label="Contract" value={project.contract ? shortAddress(project.contract, 6) : "Unknown"} />
            <Row label="Type" value={project.contractType ?? "Unknown"} />
            <Row label="Bytecode" value={project.bytecodePresent == null ? "Unknown" : project.bytecodePresent ? "Present" : "Missing"} />
            <Row label="Interfaces" value={project.interfaces.join(", ") || "None detected"} />
            <Row label="Source" value={`${project.provenance.source} · ${project.provenance.quality}`} />
          </dl>
          {project.links[0] && (
            <a className="mt-3 inline-block text-sm text-accent underline" href={project.links[0].href} target="_blank" rel="noreferrer">
              Open explorer
            </a>
          )}
        </div>
        <div className="rounded-md border border-line bg-surface p-4">
          <h2 className="text-sm font-medium">Mint status</h2>
          <div className="mt-3 text-[11px] uppercase tracking-[0.14em] text-subtle">Clock</div>
          <div className="text-2xl">
            <Countdown startTime={live?.startTime ?? nxt?.startTime ?? null} endTime={live?.endTime ?? nxt?.endTime ?? null} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
            <Row label="Price" value={formatEth(project.priceWei ?? live?.priceWei)} />
            <Row label="Minted" value={formatInt(project.minted)} />
            <Row label="Supply" value={formatInt(project.supply)} />
            <Row label="Velocity" value={project.mintVelocityPerMin == null ? "—" : `${project.mintVelocityPerMin}/m`} />
          </dl>
        </div>
      </section>

      <section className="mb-6 rounded-md border border-line bg-surface p-4">
        <h2 className="text-sm font-medium">Stage timeline</h2>
        <ol className="mt-3 space-y-2">
          {project.stages.map((s) => {
            const phase = stagePhase(s);
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-line px-3 py-2">
                <div className="flex items-center gap-2">
                  <StageBadge kind={s.kind} />
                  <span className="text-sm">{s.label}</span>
                  <span className="text-[11px] uppercase text-subtle">{phase}</span>
                </div>
                <div className="font-mono text-[12px] text-muted">
                  {formatWhen(s.startTime)} → {formatWhen(s.endTime)}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mb-6 rounded-md border border-line bg-surface p-4">
        <h2 className="text-sm font-medium">Wallet intelligence</h2>
        {wallets.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Register wallets in <Link to="/wallets" className="underline">Wallet Center</Link>.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-[0.12em] text-subtle">
                <tr>
                  <th className="py-2">Wallet</th>
                  <th>Status</th>
                  <th>Max</th>
                  <th>Evidence</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const w = wallets.find((x) => x.id === r.walletId);
                  return (
                    <tr key={r.walletId} className="border-t border-line">
                      <td className="py-2">{w?.name}</td>
                      <td>
                        <EligibilityBadge status={r.status} />
                      </td>
                      <td className="font-mono">{r.maxQuantity ?? "—"}</td>
                      <td className="text-muted">{r.evidence}</td>
                      <td className="text-muted">{r.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-md border border-line bg-surface p-4">
        <h2 className="text-sm font-medium">Prepare execution</h2>
        <p className="mt-1 text-sm text-muted">Builds standard mint(quantity) calldata. Custom mint ABIs stay UNKNOWN until an adapter exists.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_100px_auto]">
          <select
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            className="h-10 rounded-sm border border-line bg-bg px-2 text-sm"
          >
            <option value="">Select wallet</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <Input type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          <Button onClick={() => void prepareAndSim()} disabled={busy === "sim"}>
            {busy === "sim" ? "Simulating…" : "Prepare + simulate"}
          </Button>
        </div>
        {note && <p className="mt-3 text-sm text-muted">{note}</p>}
        <div className="mt-3">
          <Link to="/execution" className="text-sm underline">
            Open execution center
          </Link>
        </div>
      </section>
    </Page>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-subtle">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
