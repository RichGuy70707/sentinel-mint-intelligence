import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CanonicalTx, QueueItem, SimulationResult } from "@/core/types";

interface QueueState {
  items: QueueItem[];
  upsert: (item: Omit<QueueItem, "id" | "updatedAt"> & { id?: string }) => string;
  patch: (id: string, patch: Partial<QueueItem>) => void;
  remove: (id: string) => void;
}

export const useQueue = create<QueueState>()(
  persist(
    (set, get) => ({
      items: [],
      upsert: (item) => {
        const id = item.id ?? `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const next: QueueItem = {
          id,
          projectId: item.projectId,
          walletId: item.walletId,
          stageId: item.stageId,
          quantity: item.quantity,
          preparedTx: item.preparedTx ?? null,
          simulation: item.simulation ?? null,
          status: item.status,
          txHash: item.txHash ?? null,
          chainKey: item.chainKey,
          updatedAt: Date.now(),
        };
        const exists = get().items.some((i) => i.id === id);
        set({ items: exists ? get().items.map((i) => (i.id === id ? next : i)) : [next, ...get().items] });
        return id;
      },
      patch: (id, patch) =>
        set({
          items: get().items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)),
        }),
      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
    }),
    { name: "sentinel.queue.v1",
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.items = state.items.map((i) =>
          i.status === "AWAITING_WALLET" && i.preparedTx ? { ...i, status: "READY" } : i,
        );
      },
    },
  ),
);

export function attachPrep(id: string, tx: CanonicalTx) {
  useQueue.getState().patch(id, { preparedTx: tx, status: "PREPARED" });
}

export function attachSim(id: string, simulation: SimulationResult) {
  useQueue.getState().patch(id, {
    simulation,
    status: simulation.status === "READY" ? "READY" : "SIMULATED",
  });
}
