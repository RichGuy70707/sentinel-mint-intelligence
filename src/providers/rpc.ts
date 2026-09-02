import type { ChainKey } from "@/core/types";
import { getPool } from "./pool";

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

export async function rpcCall<T>(chainKey: ChainKey, method: string, params: unknown[]): Promise<T> {
  const pool = getPool();
  const key = `${method}:${stable(params)}`;
  return pool.request(chainKey, key, async (url) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!res.ok) throw new Error(`RPC HTTP ${res.status} for ${method}`);
    const body = (await res.json()) as JsonRpcResponse<T>;
    if (body.error) throw new Error(body.error.message);
    if (body.result === undefined) throw new Error(`RPC empty result for ${method}`);
    return body.result;
  });
}

export async function ethChainId(chainKey: ChainKey): Promise<number> {
  const hex = await rpcCall<string>(chainKey, "eth_chainId", []);
  return Number.parseInt(hex, 16);
}

export async function ethBlockNumber(chainKey: ChainKey): Promise<number> {
  const hex = await rpcCall<string>(chainKey, "eth_blockNumber", []);
  return Number.parseInt(hex, 16);
}

export async function ethGetCode(chainKey: ChainKey, address: string): Promise<string> {
  return rpcCall<string>(chainKey, "eth_getCode", [address, "latest"]);
}

export async function ethCall(chainKey: ChainKey, to: string, data: string, from?: string): Promise<string> {
  const tx: Record<string, string> = { to, data };
  if (from) tx.from = from;
  return rpcCall<string>(chainKey, "eth_call", [tx, "latest"]);
}

export async function ethEstimateGas(
  chainKey: ChainKey,
  tx: { to: string; data?: string; value?: string; from?: string },
): Promise<string> {
  return rpcCall<string>(chainKey, "eth_estimateGas", [tx]);
}

export async function ethGetBalance(chainKey: ChainKey, address: string): Promise<bigint> {
  const hex = await rpcCall<string>(chainKey, "eth_getBalance", [address, "latest"]);
  return BigInt(hex);
}

export async function ethGasPrice(chainKey: ChainKey): Promise<bigint> {
  const hex = await rpcCall<string>(chainKey, "eth_gasPrice", []);
  return BigInt(hex);
}

export interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
}

export async function ethGetLogs(
  chainKey: ChainKey,
  filter: { fromBlock: string; toBlock: string; topics?: (string | null)[]; address?: string | string[] },
): Promise<LogEntry[]> {
  return rpcCall<LogEntry[]>(chainKey, "eth_getLogs", [filter]);
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}
