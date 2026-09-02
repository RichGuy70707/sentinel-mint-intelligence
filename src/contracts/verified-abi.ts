import type { ChainKey } from "@/core/types";
import { BLOCKSCOUT_HOSTS } from "@/providers/blockscout";
import { intelCache } from "@/providers/ttl-cache";

export interface VerifiedAbi {
  verified: boolean;
  abi: Array<{ type?: string; name?: string; inputs?: { type: string }[]; stateMutability?: string }>;
  source: string;
}

export async function fetchVerifiedAbi(chainKey: ChainKey, address: string): Promise<VerifiedAbi> {
  return intelCache.wrap(`abi:${chainKey}:${address.toLowerCase()}`, 10 * 60_000, () => fetchFresh(chainKey, address));
}

async function fetchFresh(chainKey: ChainKey, address: string): Promise<VerifiedAbi> {
  const hosts = BLOCKSCOUT_HOSTS[chainKey] ?? [];
  for (const host of hosts) {
    try {
      const res = await fetch(`${host}/api/v2/smart-contracts/${address}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(2_500),
      });
      if (res.status === 404) return { verified: false, abi: [], source: "blockscout.unverified" };
      if (!res.ok) continue;
      const body = (await res.json()) as { abi?: VerifiedAbi["abi"]; is_verified?: boolean };
      const abi = Array.isArray(body.abi) ? body.abi : [];
      return {
        verified: Boolean(body.is_verified) || abi.length > 0,
        abi,
        source: "blockscout.verified",
      };
    } catch {
      continue;
    }
  }
  return { verified: false, abi: [], source: "none" };
}
