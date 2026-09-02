import type { ChainKey } from "@/core/types";

export const BLOCKSCOUT_HOSTS: Record<ChainKey, string[]> = {
  eth: ["https://eth.blockscout.com"],
  base: ["https://base.blockscout.com", "https://explorer.base.org"],
  ink: ["https://explorer.inkonchain.com"],
  rh: ["https://robinhoodchain.blockscout.com"],
};

export interface BlockscoutTransfer {
  transaction_hash?: string;
  block_number?: number;
  type?: string;
  from?: { hash?: string };
  to?: { hash?: string };
  token?: {
    address?: string;
    address_hash?: string;
    name?: string | null;
    symbol?: string | null;
    type?: string | null;
    holders?: string | null;
    total_supply?: string | null;
  };
}

const ZERO = "0x0000000000000000000000000000000000000000";

export function isMintTransfer(item: BlockscoutTransfer): boolean {
  const from = item.from?.hash?.toLowerCase();
  return item.type === "token_minting" || from === ZERO;
}

export function tokenAddress(item: BlockscoutTransfer): string | null {
  const raw = item.token?.address_hash ?? item.token?.address;
  if (!raw || raw.length < 42) return null;
  return raw.toLowerCase();
}

export async function blockscoutMintTransfers(
  chainKey: ChainKey,
): Promise<{ items: BlockscoutTransfer[]; used: boolean; error?: string; host?: string }> {
  const hosts = BLOCKSCOUT_HOSTS[chainKey] ?? [];
  let lastError: string | undefined;
  for (const host of hosts) {
    try {
      const pages = await Promise.all(
        ["ERC-721", "ERC-1155"].map(async (type) => {
          const res = await fetch(`${host}/api/v2/token-transfers?type=${encodeURIComponent(type)}`, {
            headers: { accept: "application/json" },
            signal: AbortSignal.timeout(6_000),
          });
          if (!res.ok) throw new Error(`Blockscout HTTP ${res.status}`);
          const body = (await res.json()) as { items?: BlockscoutTransfer[] };
          return body.items ?? [];
        }),
      );
      const items = pages.flat().filter(isMintTransfer);
      return { items, used: true, host };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { items: [], used: true, error: lastError };
}
