import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChainBadge, EligibilityBadge, StageBadge } from "@/components/badges";
import { Countdown } from "@/components/countdown";
import { EmptyState, Page, PageHeader } from "@/components/page";
import { evaluateProjectWallets, pickRelevantStage } from "@/eligibility/engine";
import { useCatalog } from "@/state/catalog";
import { useHints } from "@/state/hints";
import { useWallets } from "@/state/wallets";

export const Route = createFileRoute("/opportunities")({ component: OpportunitiesPage });

function OpportunitiesPage() {
  const projects = useCatalog((s) => s.projects);
  const wallets = useWallets((s) => s.wallets);
  const hintStore = useHints((s) => s.byProject);

  const rows = useMemo(() => {
    return projects.flatMap((project) =>
      evaluateProjectWallets(project, wallets, hintStore[project.id] ?? {}).map((result) => ({
        project,
        result,
        stage: pickRelevantStage(project),
      })),
    );
  }, [projects, wallets, hintStore]);

  const live = rows.filter((r) => r.result.status === "ELIGIBLE" && r.project.status === "LIVE");
  const soon = rows.filter(
    (r) => r.result.status === "NOT_STARTED" || (r.result.status === "ELIGIBLE" && r.project.status === "UPCOMING"),
  );
  const blocked = rows.filter((r) => r.result.status === "REQUIRES_PROOF" || r.result.status === "REQUIRES_VERIFICATION");

  return (
    <Page>
      <PageHeader kicker="Focus" title="My opportunities" />
      <p className="mb-5 text-sm text-muted">{rows.filter((r) => r.result.status === "ELIGIBLE").length} eligible wallet/project pairs in the current catalog.</p>
      {wallets.length === 0 && <EmptyState title="Add wallets first" body="Opportunities are computed from your registry." />}
      <Section title="Live now" rows={live} />
      <Section title="Starting soon" rows={soon} />
      <Section title="Needs proof" rows={blocked} />
    </Page>
  );
}

function Section({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof listShape>;
}) {
  if (!rows.length) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[11px] uppercase tracking-[0.16em] text-subtle">{title}</h2>
      <div className="space-y-2">
        {rows.map(({ project, result, stage }) => (
          <Link
            key={`${project.id}:${result.walletId}`}
            to="/projects/$id"
            params={{ id: encodeURIComponent(project.id) }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-3"
          >
            <div>
              <div className="text-sm font-medium">{project.name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <ChainBadge chain={project.chainKey} />
                {stage && <StageBadge kind={stage.kind} />}
                <EligibilityBadge status={result.status} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-subtle">{result.walletAddress.slice(0, 8)}</div>
              <Countdown startTime={stage?.startTime ?? null} endTime={stage?.endTime ?? null} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
