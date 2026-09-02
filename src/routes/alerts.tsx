import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, Page, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/primitives";
import { useAlerts } from "@/state/alerts";

export const Route = createFileRoute("/alerts")({ component: AlertsPage });

function AlertsPage() {
  const rules = useAlerts((s) => s.rules);
  const events = useAlerts((s) => s.events);
  const toggle = useAlerts((s) => s.toggle);
  const markRead = useAlerts((s) => s.markRead);
  const clear = useAlerts((s) => s.clear);

  return (
    <Page>
      <PageHeader
        kicker="Signals"
        title="Alerts"
        actions={
          <Button variant="ghost" onClick={clear}>
            Clear events
          </Button>
        }
      />
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium">Rules</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {rules.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => toggle(r.id)}
              className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-left text-sm"
            >
              <span>{r.type.replaceAll("_", " ")}</span>
              <span className="font-mono text-[11px] text-muted">{r.enabled ? "ON" : "OFF"}</span>
            </button>
          ))}
        </div>
      </section>
      {events.length === 0 ? (
        <EmptyState title="No events yet" body="Scans and simulations emit events when a matching rule is enabled." />
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-md border border-line px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{e.title}</div>
                <button type="button" className="text-[11px] text-muted" onClick={() => markRead(e.id)}>
                  {e.read ? "Read" : "Mark read"}
                </button>
              </div>
              <p className="mt-1 text-sm text-muted">{e.body}</p>
              <div className="mt-1 font-mono text-[11px] text-subtle">{new Date(e.createdAt).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
