import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChainKey, ProjectModel } from "@/core/types";

export interface WatchItem {
  id: string;
  chainKey: ChainKey;
  address: string;
  addedAt: number;
}

interface WatchState {
  items: WatchItem[];
  cached: Record<string, ProjectModel>;
  add: (chainKey: ChainKey, address: string) => WatchItem;
  remove: (id: string) => void;
  putCache: (project: ProjectModel) => void;
  mergeLive: (live: ProjectModel[]) => ProjectModel[];
}

export const useWatchlist = create<WatchState>()(
  persist(
    (set, get) => ({
      items: [],
      cached: {},
      add: (chainKey, address) => {
        const id = `${chainKey}:${address.toLowerCase()}`;
        const item: WatchItem = { id, chainKey, address: address.toLowerCase(), addedAt: Date.now() };
        if (get().items.some((i) => i.id === id)) return item;
        set({ items: [...get().items, item] });
        return item;
      },
      remove: (id) => {
        const cached = { ...get().cached };
        delete cached[id];
        set({ items: get().items.filter((i) => i.id !== id), cached });
      },
      putCache: (project) => set({ cached: { ...get().cached, [project.id]: project } }),
      mergeLive: (live) => {
        const map = new Map<string, ProjectModel>();
        for (const p of Object.values(get().cached)) map.set(p.id, p);
        for (const p of live) map.set(p.id, p);
        return [...map.values()];
      },
    }),
    { name: "sentinel.watchlist.v1" },
  ),
);
