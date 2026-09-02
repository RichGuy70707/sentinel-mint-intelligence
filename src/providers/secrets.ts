import type { ChainKey } from "@/core/types";

export const ALCHEMY_SLOT_NAMES = ["ALCHEMY_API_KEY", "ALCHEMY_API_KEY_2", "ALCHEMY_API_KEY_3"] as const;
export const OPENSEA_SLOT_NAMES = ["OPENSEA_API_KEY", "OPENSEA_API_KEY_2", "OPENSEA_API_KEY_3"] as const;
const ALCHEMY_CHAIN_NAMES = [
  "ALCHEMY_ETH_API_KEY",
  "ALCHEMY_BASE_API_KEY",
  "ALCHEMY_INK_API_KEY",
  "ALCHEMY_RH_API_KEY",
] as const;

const ALCHEMY_HOST: Partial<Record<ChainKey, string>> = {
  eth: "eth-mainnet",
  base: "base-mainnet",
  ink: "ink-mainnet",
};

export type EnvReader = (name: string) => string | undefined;

export function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function collect(names: readonly string[], read: EnvReader): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const v = read(name);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function listedAlchemyKeys(read: EnvReader = readEnv): string[] {
  return collect([...ALCHEMY_SLOT_NAMES, ...ALCHEMY_CHAIN_NAMES], read);
}

export function listedOpenSeaKeys(read: EnvReader = readEnv): string[] {
  return collect(OPENSEA_SLOT_NAMES, read);
}

/** @deprecated use listedAlchemyKeys; kept for chain-aware callers */
export function alchemyKey(chain: ChainKey, read: EnvReader = readEnv): string | undefined {
  if (chain === "rh") return read("ALCHEMY_RH_API_KEY");
  const dedicated =
    chain === "eth" ? read("ALCHEMY_ETH_API_KEY") : chain === "base" ? read("ALCHEMY_BASE_API_KEY") : chain === "ink" ? read("ALCHEMY_INK_API_KEY") : undefined;
  return dedicated ?? listedAlchemyKeys(read)[0];
}

export function alchemyRpcEndpoints(
  chain: ChainKey,
  read: EnvReader = readEnv,
): { id: string; url: string }[] {
  const host = ALCHEMY_HOST[chain];
  if (!host) return [];
  return listedAlchemyKeys(read).map((key, i) => ({
    id: `alchemy-${chain}-${i + 1}`,
    url: `https://${host}.g.alchemy.com/v2/${key}`,
  }));
}

export function alchemyNftEndpoints(
  chain: ChainKey,
  read: EnvReader = readEnv,
): { id: string; url: string }[] {
  const host = ALCHEMY_HOST[chain];
  if (!host) return [];
  return listedAlchemyKeys(read).map((key, i) => ({
    id: `alchemy-nft-${chain}-${i + 1}`,
    url: `https://${host}.g.alchemy.com/nft/v3/${key}`,
  }));
}

export function alchemyHttpUrl(chain: ChainKey, read: EnvReader = readEnv): string | null {
  return alchemyRpcEndpoints(chain, read)[0]?.url ?? null;
}

export function openSeaKeys(read: EnvReader = readEnv): string[] {
  return listedOpenSeaKeys(read);
}

export function providerAvailability(read: EnvReader = readEnv) {
  const alchemySlots = listedAlchemyKeys(read).length;
  const openseaSlots = listedOpenSeaKeys(read).length;
  return {
    alchemy: {
      eth: alchemySlots > 0,
      base: alchemySlots > 0,
      ink: alchemySlots > 0,
      rh: Boolean(read("ALCHEMY_RH_API_KEY")),
    },
    alchemySlotCount: alchemySlots,
    opensea: openseaSlots > 0,
    openseaKeyCount: openseaSlots,
    openseaSlotCount: openseaSlots,
  };
}
