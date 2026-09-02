import type { ChainKey } from "@/core/types";
import { alchemyHttpUrl, alchemyKey } from "./secrets.ts";

interface Transfer {
  from: string;
  to: string;
  rawContract?: { address?: string };
  hash?: string;
  blockNum?: string;
  category?: string;
}

export async function alchemyMintTransfers(
  chainKey: ChainKey,
  fromBlockHex: string,
): Promise<{ transfers: Transfer[]; used: boolean; error?: string }> {
  const url = alchemyHttpUrl(chainKey);
  if (!url) return { transfers: [], used: false };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: fromBlockHex,
            toBlock: "latest",
            fromAddress: "0x0000000000000000000000000000000000000000",
            category: ["erc721", "erc1155"],
            withMetadata: false,
            excludeZeroValue: false,
            maxCount: "0x3e8",
          },
        ],
      }),
    });
    const body = (await res.json()) as { result?: { transfers?: Transfer[] }; error?: { message: string } };
    if (body.error) return { transfers: [], used: true, error: body.error.message };
    return { transfers: body.result?.transfers ?? [], used: true };
  } catch (err) {
    return { transfers: [], used: true, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function alchemyContractMeta(
  chainKey: ChainKey,
  address: string,
): Promise<{ name: string | null; symbol: string | null; tokenType: string | null; used: boolean }> {
  const key = alchemyKey(chainKey);
  const host: Partial<Record<ChainKey, string>> = { eth: "eth-mainnet", base: "base-mainnet", ink: "ink-mainnet" };
  const h = host[chainKey];
  if (!key || !h) return { name: null, symbol: null, tokenType: null, used: false };
  try {
    const res = await fetch(
      `https://${h}.g.alchemy.com/nft/v3/${key}/getContractMetadata?contractAddress=${address}`,
    );
    if (!res.ok) return { name: null, symbol: null, tokenType: null, used: true };
    const body = (await res.json()) as {
      contractMetadata?: { name?: string; symbol?: string; tokenType?: string };
    };
    const m = body.contractMetadata;
    return {
      name: m?.name ?? null,
      symbol: m?.symbol ?? null,
      tokenType: m?.tokenType ?? null,
      used: true,
    };
  } catch {
    return { name: null, symbol: null, tokenType: null, used: true };
  }
}
