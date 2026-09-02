import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AlertEvent, AlertRule, AlertType } from "@/core/types";

const DEFAULT_RULES: AlertRule[] = [
  { id: "soon", type: "MINT_STARTING_SOON", enabled: true, threshold: 60 },
  { id: "live", type: "MINT_LIVE", enabled: true },
  { id: "elig", type: "WALLET_ELIGIBLE", enabled: true },
  { id: "stage", type: "STAGE_CHANGED", enabled: true },
  { id: "fcfs", type: "FCFS_STARTING", enabled: true },
  { id: "pub", type: "PUBLIC_STARTING", enabled: true },
  { id: "ended", type: "MINT_ENDED", enabled: false },
  { id: "supply", type: "SUPPLY_THRESHOLD", enabled: false, threshold: 100 },
  { id: "spike", type: "ACTIVITY_SPIKE", enabled: true },
  { id: "price", type: "PRICE_THRESHOLD", enabled: false },
  { id: "ready", type: "TX_READY", enabled: true },
  { id: "sim", type: "SIMULATION_FAILURE", enabled: true },
  { id: "rpc", type: "PROVIDER_FAILURE", enabled: true },
  { id: "funds", type: "INSUFFICIENT_FUNDS", enabled: true },
];

interface AlertState {
  rules: AlertRule[];
  events: AlertEvent[];
  toggle: (id: string) => void;
  push: (type: AlertType, title: string, body: string, extra?: Partial<AlertEvent>) => void;
  markRead: (id: string) => void;
  clear: () => void;
}

export const useAlerts = create<AlertState>()(
  persist(
    (set, get) => ({
      rules: DEFAULT_RULES,
      events: [],
      toggle: (id) =>
        set({ rules: get().rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) }),
      push: (type, title, body, extra) => {
        const rule = get().rules.find((r) => r.type === type);
        if (rule && !rule.enabled) return;
        const event: AlertEvent = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type,
          title,
          body,
          createdAt: Date.now(),
          read: false,
          ...extra,
        };
        set({ events: [event, ...get().events].slice(0, 200) });
      },
      markRead: (id) => set({ events: get().events.map((e) => (e.id === id ? { ...e, read: true } : e)) }),
      clear: () => set({ events: [] }),
    }),
    { name: "sentinel.alerts.v1" },
  ),
);
