import type { ChainKey, MarketSnapshot } from "@/core/types";
import { openSeaKeys } from "./secrets";

const CHAIN: Record<ChainKey, string | null> = {
  eth: "ethereum",
  base: "base",
  ink: null,
  rh: null,
};

let cursor = 0;

function nextKey(): string | null {
  const keys = openSeaKeys();
  if (!keys.length) return null;
  const key = keys[cursor % keys.length]!;
  cursor += 1;
  return key;
}

export async function openSeaMarket(chainKey: ChainKey, address: string): Promise<MarketSnapshot | null> {
  const chain = CHAIN[chainKey];
  const key = nextKey();
  if (!chain || !key) return null;
  try {
    const res = await fetch(`https://api.opensea.io/api/v2/chain/${chain}/contract/${address}`, {
      headers: { accept: "application/json", "x-api-key": key },
    });
    if (res.status === 429) {
      return {
        volumeWei: null,
        floorWei: null,
        floorChangePct: null,
        sales: null,
        quality: "STALE",
        provenance: {
          source: "OPEN_SEA_API",
          quality: "STALE",
          confidence: "LOW",
          fetchedAt: Date.now(),
          ttlMs: 30_000,
          note: "OpenSea rate limited",
        },
      };
    }
    if (!res.ok) return null;
    const body = (await res.json()) as {
      collection?: string;
      contract_standard?: string;
    };
    const slug = body.collection;
    if (!slug) {
      return {
        volumeWei: null,
        floorWei: null,
        floorChangePct: null,
        sales: null,
        quality: "UNKNOWN",
        provenance: {
          source: "OPEN_SEA_API",
          quality: "UNKNOWN",
          confidence: "LOW",
          fetchedAt: Date.now(),
          ttlMs: 60_000,
          note: "Contract has no OpenSea collection slug",
        },
      };
    }
    const statsRes = await fetch(`https://api.opensea.io/api/v2/collections/${slug}/stats`, {
      headers: { accept: "application/json", "x-api-key": key },
    });
    if (!statsRes.ok) {
      return {
        volumeWei: null,
        floorWei: null,
        floorChangePct: null,
        sales: null,
        quality: "UNKNOWN",
        provenance: {
          source: "OPEN_SEA_API",
          quality: "UNKNOWN",
          confidence: "LOW",
          fetchedAt: Date.now(),
          ttlMs: 60_000,
          note: `Collection ${slug} stats unavailable (${statsRes.status})`,
        },
      };
    }
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
    };
  } catch {
    return null;
  }
}
