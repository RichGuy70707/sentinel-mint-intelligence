import { isHexAddress, normalizeAddress } from "@/core/address";
import type { ChainKey, Confidence, Provenance } from "@/core/types";
import { CHAINS } from "@/chains/registry";
import { ethCall, ethGetCode } from "@/providers/rpc";
import { decodeCall, encodeCall, ERC165_ABI, ERC721_ABI, IERC165 } from "./abi";

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
    const readUint = async (fn: "totalSupply" | "maxSupply") => {
      try {
        const data = encodeCall(ERC721_ABI, fn, []);
        const raw = (await ethCall(chainKey, address, data)) as `0x${string}`;
        const value = decodeCall<bigint>(ERC721_ABI, fn, raw);
        return value.toString();
      } catch {
        return null;
      }
    };
    [name, symbol, totalSupply, maxSupply] = await Promise.all([
      readString("name"),
      readString("symbol"),
      readUint("totalSupply"),
      readUint("maxSupply"),
    ]);
  }

  let contractType: string | null = null;
  if (interfaces.includes("ERC1155")) contractType = "ERC-1155";
  else if (interfaces.includes("ERC721")) contractType = "ERC-721";
  else if (bytecodePresent) contractType = "UNKNOWN_CONTRACT";

  const provenance: Provenance = {
    source: "ON_CHAIN",
    quality: bytecodePresent ? "LIVE" : "UNKNOWN",
    confidence: bytecodePresent ? "HIGH" : "NONE",
    fetchedAt: Date.now(),
    ttlMs: 60_000,
    note: bytecodePresent ? "eth_getCode + eth_call" : "No bytecode at address",
  };

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
    provenance,
  };
}

export function confidenceFromIntel(intel: ContractIntel): Confidence {
  if (!intel.bytecodePresent) return "NONE";
  if (intel.interfaces.length) return "HIGH";
  return "MEDIUM";
}
