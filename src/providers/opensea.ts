import type { ChainKey, MarketSnapshot } from "@/core/types";
import { KeyPool, isRetryableProviderStatus } from "./key-pool.ts";
import { listedOpenSeaKeys } from "./secrets.ts";

const CHAIN: Record<ChainKey, string | null> = {
  eth: "ethereum",
  base: "base",
  ink: null,
  rh: null,
};

let seaPool: KeyPool | null = null;

function getOpenSeaPool(): KeyPool {
  if (!seaPool) {
    seaPool = new KeyPool(listedOpenSeaKeys().map((secret, i) => ({ id: `opensea-${i + 1}`, secret })));
  }
  return seaPool;
}

export function openSeaPoolSnapshot() {
  return getOpenSeaPool().snapshot();
}

export function openSeaLookupKind(status: number): "retry" | "not_found" | "other" {
  if (status === 401 || status === 403 || status === 429 || status >= 500) return "retry";
  if (status === 404) return "not_found";
  return "other";
}

export async function openSeaMarket(chainKey: ChainKey, address: string): Promise<MarketSnapshot | null> {
  const chain = CHAIN[chainKey];
  const pool = getOpenSeaPool();
  if (!chain || pool.size === 0) return null;
  try {
    return await pool.request(async (key) => {
      const res = await fetch(`https://api.opensea.io/api/v2/chain/${chain}/contract/${address}`, {
        headers: { accept: "application/json", "x-api-key": key },
      });
      if (openSeaLookupKind(res.status) === "retry") throw new Error(`OpenSea HTTP ${res.status}`);
      if (openSeaLookupKind(res.status) === "not_found") return empty("UNKNOWN", "OpenSea collection not found");
      if (!res.ok) {
        return empty("UNKNOWN", `OpenSea contract lookup ${res.status}`);
      }
      const body = (await res.json()) as { collection?: string };
      const slug = body.collection;
      if (!slug) return empty("UNKNOWN", "Contract has no OpenSea collection slug");
      const statsRes = await fetch(`https://api.opensea.io/api/v2/collections/${slug}/stats`, {
        headers: { accept: "application/json", "x-api-key": key },
      });
      if (isRetryableProviderStatus(statsRes.status)) throw new Error(`OpenSea stats HTTP ${statsRes.status}`);
      if (!statsRes.ok) return empty("UNKNOWN", `Collection ${slug} stats unavailable (${statsRes.status})`);
      const stats = (await statsRes.json()) as {
        total?: { volume?: number; sales?: number; floor_price?: number };
      };
      const floorEth = stats.total?.floor_price;
      const volumeEth = stats.total?.volume;
      return {
        volumeWei: volumeEth != null ? BigInt(Math.round(volumeEth * 1e18)).toString() : null,
        floorWei: floorEth != null ? BigInt(Math.round(floorEth * 1e18)).toString() : null,
        floorChangePct: null,
        sales: stats.total?.sales ?? null,
        quality: floorEth != null || volumeEth != null ? "LIVE" : "UNKNOWN",
        provenance: {
          source: "OPEN_SEA_API",
          quality: floorEth != null ? "LIVE" : "UNKNOWN",
          confidence: "MEDIUM",
          fetchedAt: Date.now(),
          ttlMs: 60_000,
          note: `OpenSea collection ${slug}`,
        },
      } satisfies MarketSnapshot;
    });
  } catch {
    return empty("STALE", "OpenSea keys exhausted or rate limited");
  }
}

function empty(quality: MarketSnapshot["quality"], note: string): MarketSnapshot {
  return {
    volumeWei: null,
    floorWei: null,
    floorChangePct: null,
    sales: null,
    quality,
    provenance: {
      source: "OPEN_SEA_API",
      quality,
      confidence: "LOW",
      fetchedAt: Date.now(),
      ttlMs: quality === "STALE" ? 30_000 : 60_000,
      note,
    },
  };
}
