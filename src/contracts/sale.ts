import type { ChainKey } from "@/core/types";
import { normalizeTimestamp } from "@/core/time";
import { ethCall } from "@/providers/rpc";
import { decodeCall, encodeCall, ERC721_ABI, SEADROP_ABI } from "./abi";
import { encodeFunctionData, type Abi } from "viem";

const PRICE_ABI = [
  { type: "function", name: "mintPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "cost", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "price", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "publicPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "publicSalePrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "tokenPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "mint_price", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;

const WINDOW_ABI = [
  { type: "function", name: "saleStart", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "saleEnd", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "publicSaleStart", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "publicSaleEnd", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "startTime", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "endTime", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;

const MERKLE_ABI = [
  { type: "function", name: "merkleRoot", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "allowListRoot", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
] as const satisfies Abi;

const OWNER_ABI = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const satisfies Abi;

const SEADROP = "0x00005ea00ac477b1030ce78506496e8c2de24bf5";
const ZERO_ROOT = "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface SaleIntel {
  priceWei: string | null;
  maxPerWallet: number | null;
  startTime: number | null;
  endTime: number | null;
  seadrop: boolean;
  merkleRoot: boolean;
  owner: string | null;
  source: string;
}

export async function probeSale(chainKey: ChainKey, address: string): Promise<SaleIntel> {
  const result: SaleIntel = {
    priceWei: null,
    maxPerWallet: null,
    startTime: null,
    endTime: null,
    seadrop: false,
    merkleRoot: false,
    owner: null,
    source: "none",
  };

  try {
    const data = encodeFunctionData({
      abi: SEADROP_ABI,
      functionName: "getPublicDrop",
      args: [address as `0x${string}`],
    });
    const raw = (await ethCall(chainKey, SEADROP, data)) as `0x${string}`;
    const drop = decodeCall<{
      mintPrice: bigint;
      startTime: bigint;
      endTime: bigint;
      maxTotalMintableByWallet: number;
    }>(SEADROP_ABI, "getPublicDrop", raw);
    const configured = Boolean(drop && (drop.startTime > 0n || drop.endTime > 0n));
    if (drop && configured) {
      result.seadrop = true;
      result.priceWei = drop.mintPrice.toString();
      result.startTime = normalizeTimestamp(Number(drop.startTime) * 1000);
      result.endTime = normalizeTimestamp(Number(drop.endTime) * 1000);
      result.maxPerWallet = Number(drop.maxTotalMintableByWallet);
      result.source = "seadrop.getPublicDrop";
    }
  } catch {
    /* not a SeaDrop collection */
  }

  if (result.priceWei == null) {
    for (const fn of [
      "mintPrice",
      "cost",
      "price",
      "publicPrice",
      "publicSalePrice",
      "tokenPrice",
      "getPrice",
      "mint_price",
    ] as const) {
      try {
        const data = encodeCall(PRICE_ABI, fn, []);
        const raw = (await ethCall(chainKey, address, data)) as `0x${string}`;
        const value = decodeCall<bigint>(PRICE_ABI, fn, raw);
        result.priceWei = value.toString();
        result.source = `eth_call.${fn}`;
        break;
      } catch {
        continue;
      }
    }
  }

  if (result.startTime == null) {
    result.startTime = await readWindow(chainKey, address, ["saleStart", "publicSaleStart", "startTime"]);
  }
  if (result.endTime == null) {
    result.endTime = await readWindow(chainKey, address, ["saleEnd", "publicSaleEnd", "endTime"]);
  }

  result.merkleRoot = await readMerklePresent(chainKey, address);

  try {
    const data = encodeCall(OWNER_ABI, "owner", []);
    const raw = (await ethCall(chainKey, address, data)) as `0x${string}`;
    result.owner = decodeCall<string>(OWNER_ABI, "owner", raw);
  } catch {
    try {
      const data = encodeCall(ERC721_ABI, "ownerOf", [1n]);
      const raw = (await ethCall(chainKey, address, data)) as `0x${string}`;
      result.owner = decodeCall<string>(ERC721_ABI, "ownerOf", raw);
    } catch {
      /* deployer unknown */
    }
  }

  return result;
}

async function readWindow(
  chainKey: ChainKey,
  address: string,
  fns: Array<"saleStart" | "saleEnd" | "publicSaleStart" | "publicSaleEnd" | "startTime" | "endTime">,
): Promise<number | null> {
  for (const fn of fns) {
    try {
      const data = encodeCall(WINDOW_ABI, fn, []);
      const raw = (await ethCall(chainKey, address, data)) as `0x${string}`;
      const value = decodeCall<bigint>(WINDOW_ABI, fn, raw);
      const ts = normalizeTimestamp(Number(value) > 1e12 ? Number(value) : Number(value) * 1000);
      if (ts != null) return ts;
    } catch {
      continue;
    }
  }
  return null;
}

async function readMerklePresent(chainKey: ChainKey, address: string): Promise<boolean> {
  for (const fn of ["merkleRoot", "allowListRoot"] as const) {
    try {
      const data = encodeCall(MERKLE_ABI, fn, []);
      const raw = (await ethCall(chainKey, address, data)) as `0x${string}`;
      const value = decodeCall<string>(MERKLE_ABI, fn, raw);
      if (value && value.toLowerCase() !== ZERO_ROOT) return true;
    } catch {
      continue;
    }
  }
  return false;
}
