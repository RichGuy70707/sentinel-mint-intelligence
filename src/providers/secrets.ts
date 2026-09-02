import type { ChainKey } from "@/core/types";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function alchemyKey(chain: ChainKey): string | undefined {
  if (chain === "eth") return env("ALCHEMY_ETH_API_KEY") ?? env("ALCHEMY_API_KEY");
  if (chain === "base") return env("ALCHEMY_BASE_API_KEY") ?? env("ALCHEMY_API_KEY");
  if (chain === "ink") return env("ALCHEMY_INK_API_KEY");
  if (chain === "rh") return env("ALCHEMY_RH_API_KEY");
  return undefined;
}

export function alchemyHttpUrl(chain: ChainKey): string | null {
  const key = alchemyKey(chain);
  if (!key) return null;
  const host: Partial<Record<ChainKey, string>> = {
    eth: "eth-mainnet",
    base: "base-mainnet",
    ink: "ink-mainnet",
  };
  const h = host[chain];
  if (!h) return null;
  return `https://${h}.g.alchemy.com/v2/${key}`;
}

export function openSeaKeys(): string[] {
  return [env("OPENSEA_API_KEY"), env("OPENSEA_API_KEY_2")].filter((k): k is string => Boolean(k));
}

export function providerAvailability() {
  return {
    alchemy: {
      eth: Boolean(alchemyKey("eth")),
      base: Boolean(alchemyKey("base")),
      ink: Boolean(alchemyKey("ink")),
      rh: Boolean(alchemyKey("rh")),
    },
    opensea: openSeaKeys().length > 0,
    openseaKeyCount: openSeaKeys().length,
  };
}
