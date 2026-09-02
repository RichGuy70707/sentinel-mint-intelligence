import { createFileRoute } from "@tanstack/react-router";
import { ChainBadge } from "@/components/badges";
import { EmptyState, Page, PageHeader } from "@/components/page";
import { formatEth, formatInt } from "@/lib/format";
import { useCatalog } from "@/state/catalog";

export const Route = createFileRoute("/market")({ component: MarketPage });

function MarketPage() {
  const projects = useCatalog((s) => s.projects);
  return (
    <Page>
      <PageHeader kicker="Book" title="Market" />
      <p className="mb-5 text-sm text-muted">
        Floor and volume are marked UNKNOWN unless a live market adapter returns them. Do not treat empty cells as
        zero.
      </p>
      {projects.length === 0 ? (
        <EmptyState title="No collections in memory" body="Run a scan to populate the book." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-subtle">
              <tr>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Chain</th>
                <th className="px-3 py-2">Floor</th>
                <th className="px-3 py-2">Volume</th>
                <th className="px-3 py-2">Sales</th>
                <th className="px-3 py-2">Quality</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-line/70">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2">
                    <ChainBadge chain={p.chainKey} />
                  </td>
                  <td className="px-3 py-2 font-mono">{formatEth(p.market?.floorWei ?? null)}</td>
                  <td className="px-3 py-2 font-mono">{formatEth(p.market?.volumeWei ?? null)}</td>
                  <td className="px-3 py-2 font-mono">{formatInt(p.market?.sales ?? null)}</td>
                  <td className="px-3 py-2 text-muted">{p.market?.quality ?? "UNKNOWN"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
