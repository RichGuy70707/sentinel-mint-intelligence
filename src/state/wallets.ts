import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isHexAddress, normalizeAddress } from "@/core/address";
import type { WalletRecord } from "@/core/types";

interface WalletState {
  wallets: WalletRecord[];
  addWallet: (input: { name: string; address: string; notes?: string; tags?: string[] }) => WalletRecord;
  updateWallet: (id: string, patch: Partial<WalletRecord>) => void;
  removeWallet: (id: string) => void;
}

function uid(): string {
  return `w_${Math.random().toString(36).slice(2, 10)}`;
}

export const useWallets = create<WalletState>()(
  persist(
    (set, get) => ({
      wallets: [],
      addWallet: ({ name, address, notes, tags }) => {
        if (!isHexAddress(address)) throw new Error("Invalid address");
        const normalized = normalizeAddress(address);
        if (get().wallets.some((w) => w.address === normalized)) {
          throw new Error("Wallet already registered");
        }
        const record: WalletRecord = {
          id: uid(),
          name: name.trim() || "Untitled",
          address: normalized,
          notes: notes ?? "",
          tags: tags ?? [],
          enabled: true,
          favorite: false,
          priority: get().wallets.length + 1,
          createdAt: Date.now(),
        };
        set({ wallets: [...get().wallets, record] });
        return record;
      },
      updateWallet: (id, patch) => {
        set({
          wallets: get().wallets.map((w) => (w.id === id ? { ...w, ...patch, id: w.id, address: w.address } : w)),
        });
      },
      removeWallet: (id) => set({ wallets: get().wallets.filter((w) => w.id !== id) }),
    }),
    { name: "sentinel.wallets.v1" },
  ),
);
