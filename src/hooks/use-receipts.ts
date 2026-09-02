import { useEffect, useRef } from "react";
import type { ChainKey } from "@/core/types";
import { applyAuthorizeEvent } from "@/execution/state";
import { receiptFn } from "@/server/functions";
import { useCatalog } from "@/state/catalog";
import { useQueue } from "@/state/queue";

const MAX_POLLS = 24;
const INTERVAL_MS = 4_000;
const pollCounts = new Map<string, number>();

export function useReceiptTracker() {
  const items = useQueue((s) => s.items);
  const projects = useCatalog((s) => s.projects);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  useEffect(() => {
    const pending = items.filter(
      (i) => i.txHash && (i.status === "SUBMITTED" || i.status === "PENDING" || i.status === "BROADCAST"),
    );
    if (!pending.length) return;
    let cancelled = false;

    async function tick() {
      for (const item of pending) {
        if (cancelled || !item.txHash) continue;
        const n = (pollCounts.get(item.id) ?? 0) + 1;
        pollCounts.set(item.id, n);
        if (n > MAX_POLLS) {
          useQueue.getState().patch(item.id, { status: "PENDING" });
          continue;
        }
        const project = projectsRef.current.find((p) => p.id === item.projectId);
        const chainKey = (item.chainKey ?? project?.chainKey) as ChainKey | undefined;
        if (!chainKey) continue;
        try {
          const rec = await receiptFn({ data: { chainKey, hash: item.txHash } });
          if (cancelled) return;
          if (rec.kind === "CONFIRMED") {
            pollCounts.delete(item.id);
            useQueue.getState().patch(item.id, { status: applyAuthorizeEvent(item.status, { type: "RECEIPT_CONFIRMED" }) });
          } else if (rec.kind === "REVERTED") {
            pollCounts.delete(item.id);
            useQueue.getState().patch(item.id, { status: applyAuthorizeEvent(item.status, { type: "RECEIPT_REVERTED" }) });
          } else if (rec.kind === "PENDING") {
            useQueue.getState().patch(item.id, { status: applyAuthorizeEvent(item.status, { type: "RECEIPT_PENDING" }) });
          }
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
  }, [items]);
}