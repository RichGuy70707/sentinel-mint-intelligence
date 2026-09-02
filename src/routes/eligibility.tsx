import { createFileRoute } from "@tanstack/react-router";
import { EligibilityBadge, StageBadge } from "@/components/badges";
import { EmptyState, Page, PageHeader } from "@/components/page";
import { evaluateProjectWallets, pickRelevantStage } from "@/eligibility/engine";
import { useCatalog } from "@/state/catalog";
import { useHints } from "@/state/hints";
import { useWallets } from "@/state/wallets";

export const Route = createFileRoute("/eligibility")({ component: EligibilityPage });

function EligibilityPage() {
  const projects = useCatalog((s) => s.projects);
  const wallets = useWallets((s) => s.wallets);
  const byProject = useHints((s) => s.byProject);
  const rows = projects.flatMap((project) => {
    const stage = pickRelevantStage(project);
    return evaluateProjectWallets(project, wallets, byProject[project.id] ?? {}).map((result) => ({
      project,
      stage,
      result,
    }));
  });

  return (
    <Page>
      <PageHeader kicker="Matrix" title="Eligibility" />
      {rows.length === 0 ? (
        <EmptyState title="Nothing to score" body="Add wallets and load at least one project." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[800px] text-left text-[13px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-subtle">
              <tr>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Wallet</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Evidence</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ project, stage, result }) => (
                <tr key={`${project.id}:${result.walletId}`} className="border-b border-line/70">
                  <td className="px-3 py-2">{project.name}</td>
                  <td className="px-3 py-2">{wallets.find((w) => w.id === result.walletId)?.name}</td>
                  <td className="px-3 py-2">{stage ? <StageBadge kind={stage.kind} /> : "—"}</td>
                  <td className="px-3 py-2">
                    <EligibilityBadge status={result.status} />
                  </td>
                  <td className="px-3 py-2 text-muted">{result.evidence}</td>
                  <td className="px-3 py-2 text-muted">{result.confidence}</td>
                  <td className="px-3 py-2 text-muted">{result.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
