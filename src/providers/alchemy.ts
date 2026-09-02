import type { ChainKey } from "@/core/types";
import { alchemyNftEndpoints, alchemyRpcEndpoints } from "./secrets.ts";
import { sanitizeProviderText } from "./sanitize.ts";

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
  const endpoints = alchemyRpcEndpoints(chainKey);
  if (!endpoints.length) return { transfers: [], used: false };
  let lastError: string | undefined;
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
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
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const body = (await res.json()) as { result?: { transfers?: Transfer[] }; error?: { message: string } };
      if (body.error) {
        lastError = body.error.message;
        continue;
      }
      return { transfers: body.result?.transfers ?? [], used: true };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { transfers: [], used: true, error: sanitizeProviderText(lastError) ?? "Alchemy transfers unavailable" };
}

export async function alchemyContractMeta(
  chainKey: ChainKey,
  address: string,
): Promise<{ name: string | null; symbol: string | null; tokenType: string | null; used: boolean }> {
  const endpoints = alchemyNftEndpoints(chainKey);
  if (!endpoints.length) return { name: null, symbol: null, tokenType: null, used: false };
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${ep.url}/getContractMetadata?contractAddress=${address}`);
      if (!res.ok) continue;
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
      /* try next slot */
    }
  }
  return { name: null, symbol: null, tokenType: null, used: true };
}
