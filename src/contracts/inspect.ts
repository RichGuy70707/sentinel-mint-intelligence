import { isHexAddress, normalizeAddress } from "@/core/address";
import type { ChainKey, Confidence, Provenance } from "@/core/types";
import { CHAINS } from "@/chains/registry";
import { ethCall, ethGetCode } from "@/providers/rpc";
import { intelCache } from "@/providers/ttl-cache";
import { decodeCall, encodeCall, ERC165_ABI, ERC721_ABI, IERC165 } from "./abi";
import type { Abi } from "viem";

const ERC20_DECIMALS_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const satisfies Abi;

const SUPPLY_ABI = [
  { type: "function", name: "maxSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "MAX_SUPPLY", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxTokens", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "collectionSize", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;

export interface ContractIntel {
  chainKey: ChainKey;
  chainId: number;
  address: string;
  bytecodePresent: boolean;
  bytecodeBytes: number;
  name: string | null;
  symbol: string | null;
  totalSupply: string | null;
  maxSupply: string | null;
  interfaces: string[];
  contractType: string | null;
  provenance: Provenance;
}

export async function inspectContract(chainKey: ChainKey, rawAddress: string): Promise<ContractIntel> {
  if (!isHexAddress(rawAddress)) throw new Error("Invalid contract address");
  const address = normalizeAddress(rawAddress);
  return intelCache.wrap(`inspect:${chainKey}:${address}`, 45_000, () => inspectFresh(chainKey, address));
}

async function inspectFresh(chainKey: ChainKey, address: string): Promise<ContractIntel> {
  const code = await ethGetCode(chainKey, address);
  const bytecodePresent = Boolean(code && code !== "0x" && code !== "0x0");
  const interfaces: string[] = [];
  let name: string | null = null;
  let symbol: string | null = null;
  let totalSupply: string | null = null;
  let maxSupply: string | null = null;

  if (bytecodePresent) {
    const probe = async (id: string, label: string) => {
      try {
        const data = encodeCall(ERC165_ABI, "supportsInterface", [id]);
        const raw = (await ethCall(chainKey, address, data)) as `0x${string}`;
        const ok = decodeCall<boolean>(ERC165_ABI, "supportsInterface", raw);
        if (ok) interfaces.push(label);
      } catch {
        /* interface unknown */
      }
    };
    await Promise.all([
      probe(IERC165.ERC721, "ERC721"),
      probe(IERC165.ERC1155, "ERC1155"),
      probe(IERC165.ERC721Metadata, "ERC721Metadata"),
    ]);

    const readString = async (fn: "name" | "symbol") => {
      try {
        const data = encodeCall(ERC721_ABI, fn, []);
        const raw = (await ethCall(chainKey, address, data)) as `0x${string}`;
        const value = decodeCall<string>(ERC721_ABI, fn, raw);
        return value || null;
      } catch {
        return null;
      }
    };
    const readUint = async () => {
      try {
        const data = encodeCall(ERC721_ABI, "totalSupply", []);
        const raw = (await ethCall(chainKey, address, data)) as `0x${string}`;
        return decodeCall<bigint>(ERC721_ABI, "totalSupply", raw).toString();
      } catch {
        return null;
      }
    };
    const readMax = async () => {
      for (const fn of ["maxSupply", "MAX_SUPPLY", "maxTokens", "collectionSize"] as const) {
        try {
          const data = encodeCall(SUPPLY_ABI, fn, []);
          const raw = (await ethCall(chainKey, address, data)) as `0x${string}`;
          return decodeCall<bigint>(SUPPLY_ABI, fn, raw).toString();
        } catch {
          continue;
        }
      }
      return null;
    };
    [name, symbol, totalSupply, maxSupply] = await Promise.all([
      readString("name"),
      readString("symbol"),
      readUint(),
      readMax(),
    ]);
  }

  let contractType: string | null = null;
  if (interfaces.includes("ERC1155")) contractType = "ERC-1155";
  else if (interfaces.includes("ERC721")) contractType = "ERC-721";
  else if (bytecodePresent) {
    const decimals = await readDecimals(chainKey, address);
    contractType = decimals != null ? "ERC-20" : "UNKNOWN_CONTRACT";
    if (decimals != null) interfaces.push("ERC20");
  }

  return {
    chainKey,
    chainId: CHAINS[chainKey].id,
    address,
    bytecodePresent,
    bytecodeBytes: bytecodePresent ? Math.max(0, (code.length - 2) / 2) : 0,
    name,
    symbol,
    totalSupply,
    maxSupply,
    interfaces,
    contractType,
    provenance: {
      source: "ON_CHAIN",
      quality: bytecodePresent ? "LIVE" : "UNKNOWN",
      confidence: bytecodePresent ? "HIGH" : "NONE",
      fetchedAt: Date.now(),
      ttlMs: 45_000,
      note: bytecodePresent ? "eth_getCode + eth_call" : "No bytecode at address",
    },
  };
}

async function readDecimals(chainKey: ChainKey, address: string): Promise<number | null> {
  try {
    const data = encodeCall(ERC20_DECIMALS_ABI, "decimals", []);
    const raw = (await ethCall(chainKey, address, data)) as `0x${string}`;
    const value = Number(decodeCall<number>(ERC20_DECIMALS_ABI, "decimals", raw));
    return Number.isInteger(value) && value >= 0 && value <= 18 ? value : null;
  } catch {
    return null;
  }
}

export function confidenceFromIntel(intel: ContractIntel): Confidence {
  if (!intel.bytecodePresent) return "NONE";
  if (intel.interfaces.length) return "HIGH";
  return "MEDIUM";
}
