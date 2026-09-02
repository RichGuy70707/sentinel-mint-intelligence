import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, Page, PageHeader } from "@/components/page";
import { formatInt } from "@/lib/format";
import { useCatalog } from "@/state/catalog";

export const Route = createFileRoute("/activity")({ component: ActivityPage });

function ActivityPage() {
  const projects = useCatalog((s) => s.projects);
  const scannedAt = useCatalog((s) => s.scannedAt);
  const rows = [...projects].sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0));
  return (
    <Page>
      <PageHeader kicker="Tape" title="Activity" />
      <p className="mb-4 text-sm text-muted">
        Last scan {scannedAt ? new Date(scannedAt).toLocaleString() : "has not completed"}.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="Quiet tape" body="Mint Transfer events will land here after a scan." />
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2">
              <div>
                <div className="text-sm">{p.name}</div>
                <div className="text-[12px] text-muted">
                  {p.chainKey.toUpperCase()} · minted sample {formatInt(p.minted)} · unique {formatInt(p.uniqueMinters)}
                </div>
              </div>
              <div className="font-mono text-[12px] text-subtle">
                {p.lastActivityAt ? new Date(p.lastActivityAt).toLocaleTimeString() : "—"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
