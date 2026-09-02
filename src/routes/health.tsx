import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/primitives";
import { useScanner } from "@/hooks/use-scanner";
import { useCatalog } from "@/state/catalog";

export const Route = createFileRoute("/health")({ component: HealthPage });

function HealthPage() {
  const health = useCatalog((s) => s.health);
  const scanning = useCatalog((s) => s.scanning);
  const errors = useCatalog((s) => s.errors);
  const mintgoNote = useCatalog((s) => s.mintgoNote);
  const scan = useScanner();

  return (
    <Page>
      <PageHeader
        kicker="Ops"
        title="System health"
        actions={
          <Button variant="ghost" onClick={() => void scan()} disabled={scanning}>
            Probe now
          </Button>
        }
      />
      <p className="mb-4 text-sm text-muted">
        Provider states come from live RPC probes. Latency is measured, not advertised.
      </p>
      {mintgoNote && <p className="mb-3 text-[12px] text-subtle">{mintgoNote}</p>}
      {errors.map((e) => (
        <p key={e.chainKey} className="text-sm text-warn">
          {e.chainKey}: {e.message}
        </p>
      ))}
      <div className="mt-4 overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-subtle">
            <tr>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Chain</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Latency</th>
              <th className="px-3 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {(health?.providers ?? []).map((p) => (
              <tr key={p.id} className="border-b border-line/70">
                <td className="px-3 py-2 font-mono">{p.id}</td>
                <td className="px-3 py-2">{p.chainKey}</td>
                <td className="px-3 py-2">{p.state}</td>
                <td className="px-3 py-2 font-mono">{p.latencyMs == null ? "—" : `${p.latencyMs} ms`}</td>
                <td className="px-3 py-2 text-muted">{p.lastError ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
