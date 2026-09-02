import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { MintCard } from "@/components/mint-card";
import { EmptyState, Page, PageHeader } from "@/components/page";
import { Button, Input } from "@/components/ui/primitives";
import { applyFilters, DEFAULT_FILTERS, type MintFilters } from "@/core/filters";
import { isHexAddress } from "@/core/address";
import { inspectProjectFn } from "@/server/functions";
import { useCatalog } from "@/state/catalog";
import { useWatchlist } from "@/state/watchlist";
import type { ChainKey } from "@/core/types";

export const Route = createFileRoute("/projects")({ component: ProjectsPage });

function ProjectsPage() {
  const projects = useCatalog((s) => s.projects);
  const upsert = useCatalog((s) => s.upsert);
  const addWatch = useWatchlist((s) => s.add);
  const putCache = useWatchlist((s) => s.putCache);
  const [filters, setFilters] = useState<MintFilters>(DEFAULT_FILTERS);
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<ChainKey>("eth");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rows = useMemo(() => applyFilters(projects, filters), [projects, filters]);

  async function inspect() {
    setErr(null);
    if (!isHexAddress(address)) {
      setErr("Enter a valid 0x address");
      return;
    }
    setBusy(true);
    try {
      const project = await inspectProjectFn({ data: { chainKey: chain, address } });
      upsert(project);
      addWatch(chain, address);
      putCache(project);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Inspect failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <PageHeader kicker="Catalog" title="Projects" />
      <div className="mb-5 grid gap-2 rounded-md border border-line bg-surface p-3 sm:grid-cols-[140px_1fr_auto]">
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value as ChainKey)}
          className="h-10 rounded-sm border border-line bg-bg px-2 text-sm"
        >
          <option value="eth">ETH</option>
          <option value="rh">RH</option>
          <option value="ink">INK</option>
          <option value="base">BASE</option>
        </select>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Inspect contract 0x…" />
        <Button onClick={() => void inspect()} disabled={busy}>
          {busy ? "Reading…" : "Inspect"}
        </Button>
      </div>
      {err && <p className="mb-3 text-sm text-danger">{err}</p>}
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {rows.map((p) => (
          <MintCard key={p.id} project={p} />
        ))}
      </div>
      {rows.length === 0 && (
        <div className="mt-6">
          <EmptyState title="No projects match" body="Scan the network or inspect a known mint contract." />
        </div>
      )}
    </Page>
  );
}
