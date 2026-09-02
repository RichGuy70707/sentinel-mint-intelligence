import { createFileRoute, Link } from "@tanstack/react-router";
import { EligibilityBadge } from "@/components/badges";
import { EmptyState, Page, PageHeader } from "@/components/page";
import { shortAddress } from "@/core/address";
import { evaluateProjectWallets } from "@/eligibility/engine";
import { useCatalog } from "@/state/catalog";
import { useHints } from "@/state/hints";
import { useWallets } from "@/state/wallets";

export const Route = createFileRoute("/wallets/$id")({ component: WalletDetail });

function WalletDetail() {
  const { id } = Route.useParams();
  const wallet = useWallets((s) => s.wallets.find((w) => w.id === id));
  const projects = useCatalog((s) => s.projects);
  const hintStore = useHints((s) => s.byProject);

  if (!wallet) {
    return (
      <Page>
        <EmptyState title="Wallet not found" body="It may have been removed from the registry." />
      </Page>
    );
  }

  const rows = projects.flatMap((p) =>
    evaluateProjectWallets(p, [wallet], hintStore[p.id] ?? {}).map((r) => ({ project: p, result: r })),
  );

  return (
    <Page>
      <PageHeader kicker="Wallet" title={wallet.name} />
      <p className="mb-2 font-mono text-sm text-muted">{shortAddress(wallet.address, 8)}</p>
      <p className="mb-6 text-sm text-muted">{wallet.notes || "No notes."}</p>
      <h2 className="mb-3 text-sm font-medium">What this wallet can mint</h2>
      {rows.length === 0 ? (
        <EmptyState title="No projects loaded" body="Scan or inspect a contract first." />
      ) : (
        <div className="space-y-2">
          {rows.map(({ project, result }) => (
            <Link
              key={project.id}
              to="/projects/$id"
              params={{ id: encodeURIComponent(project.id) }}
              className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm">{project.name}</div>
                <div className="truncate text-[11px] text-muted">{result.reason}</div>
              </div>
              <EligibilityBadge status={result.status} />
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
