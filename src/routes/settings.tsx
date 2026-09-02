import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/primitives";
import { useAlerts } from "@/state/alerts";
import { useCatalog } from "@/state/catalog";
import { useQueue } from "@/state/queue";
import { useWatchlist } from "@/state/watchlist";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const notes = useCatalog((s) => s.health?.notes ?? []);
  return (
    <Page>
      <PageHeader kicker="Preferences" title="Settings" />
      <div className="space-y-4 text-sm text-muted">
        <p>Wallets, alerts, watchlist, and the execution queue persist in this browser. Keys never leave the server environment.</p>
        <p>Discovery uses Blockscout public mint feeds plus chunked eth_getLogs. Alchemy and OpenSea adapters arm only when their environment keys are present — never hardcoded.</p>
        <p>Configure ALCHEMY_ETH_API_KEY / ALCHEMY_API_KEY, ALCHEMY_BASE_API_KEY, ALCHEMY_INK_API_KEY, ALCHEMY_RH_API_KEY, OPENSEA_API_KEY, and OPENSEA_API_KEY_2 in the deployment environment. Missing keys keep those adapters dark and related fields marked UNKNOWN.</p>
        <ul className="space-y-1 font-mono text-[12px]">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              useAlerts.getState().clear();
              useQueue.setState({ items: [] });
              useWatchlist.setState({ items: [], cached: {} });
            }}
          >
            Clear local caches
          </Button>
        </div>
      </div>
    </Page>
  );
}
