import type { ChainKey } from "@/core/types";
import { classifyHttpStatus, RpcError } from "./classify";
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
    if (!res.ok) throw new RpcError(`RPC HTTP ${res.status} for ${method}`, classifyHttpStatus(res.status), res.status);
    const body = (await res.json()) as JsonRpcResponse<T>;
    if (body.error) {
      const msg = body.error.message || `RPC error ${body.error.code}`;
      const app = /execution reverted|revert(?:ed)?|out of gas|invalid opcode/i.test(msg);
      throw new RpcError(msg, app ? "APPLICATION" : "UNKNOWN");
    }
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

export async function ethCall(
  chainKey: ChainKey,
  to: string,
  data: string,
  from?: string,
  value?: string,
): Promise<string> {
  const tx: Record<string, string> = { to, data };
  if (from) tx.from = from;
  if (value && value !== "0x" && value !== "0") tx.value = value.startsWith("0x") ? value : toRpcHex(value);
  return rpcCall<string>(chainKey, "eth_call", [tx, "latest"]);
}

function toRpcHex(value: string): string {
  return `0x${BigInt(value).toString(16)}`;
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

export async function ethGetTransactionReceipt(
  chainKey: ChainKey,
  hash: string,
): Promise<{ status: "0x0" | "0x1" | null; blockNumber: string | null } | null> {
  const rec = await rpcCall<{ status?: string; blockNumber?: string } | null>(
    chainKey,
    "eth_getTransactionReceipt",
    [hash],
  );
  if (!rec) return null;
  const status = rec.status === "0x1" || rec.status === "0x0" ? rec.status : null;
  return { status, blockNumber: rec.blockNumber ?? null };
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}
