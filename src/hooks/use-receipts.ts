import { useEffect } from "react";
import { applyAuthorizeEvent } from "@/execution/state";
import { receiptFn } from "@/server/functions";
import { useCatalog } from "@/state/catalog";
import { useQueue } from "@/state/queue";

const MAX_POLLS = 24;
const INTERVAL_MS = 4_000;

export function useReceiptTracker() {
  const items = useQueue((s) => s.items);
  const projects = useCatalog((s) => s.projects);

  useEffect(() => {
    const pending = items.filter(
      (i) => i.txHash && (i.status === "SUBMITTED" || i.status === "PENDING" || i.status === "BROADCAST"),
    );
    if (!pending.length) return;
    let cancelled = false;
    const polls = new Map<string, number>();

    async function tick() {
      for (const item of pending) {
        if (cancelled || !item.txHash) continue;
        const n = (polls.get(item.id) ?? 0) + 1;
        polls.set(item.id, n);
        if (n > MAX_POLLS) continue;
        const project = projects.find((p) => p.id === item.projectId);
        if (!project) continue;
        try {
          const rec = await receiptFn({ data: { chainKey: project.chainKey, hash: item.txHash } });
          if (cancelled) return;
          if (rec.kind === "CONFIRMED") {
            useQueue.getState().patch(item.id, { status: applyAuthorizeEvent(item.status, { type: "RECEIPT_CONFIRMED" }) });
          } else if (rec.kind === "REVERTED") {
            useQueue.getState().patch(item.id, { status: applyAuthorizeEvent(item.status, { type: "RECEIPT_REVERTED" }) });
          } else if (rec.kind === "PENDING") {
            useQueue.getState().patch(item.id, { status: applyAuthorizeEvent(item.status, { type: "RECEIPT_PENDING" }) });
          }
          /* provider error: leave pending, do not stamp FAILED */
        } catch {
          /* keep pending */
        }
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [items, projects]);
}
