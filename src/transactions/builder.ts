import { encodeFunctionData } from "viem";
import { isHexAddress, normalizeAddress } from "@/core/address";
import type { CanonicalTx, ChainKey, Confidence } from "@/core/types";
import { CHAINS } from "@/chains/registry";
import { COMMON_MINT_ABI } from "@/contracts/abi";

export type MintFn = "mint" | "publicMint" | "mintPublic";

export interface BuildMintInput {
  chainKey: ChainKey;
  contract: string;
  wallet: string;
  quantity: number;
  priceWeiPerMint: string | null;
  fn?: MintFn;
  source?: string;
}

export function validateBuildInput(input: BuildMintInput): string[] {
  const errors: string[] = [];
  if (!isHexAddress(input.contract)) errors.push("Invalid contract");
  if (!isHexAddress(input.wallet)) errors.push("Invalid wallet");
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 20) {
    errors.push("Quantity must be an integer from 1 to 20");
  }
  if (input.priceWeiPerMint != null) {
    try {
      if (BigInt(input.priceWeiPerMint) < 0n) errors.push("Negative price");
    } catch {
      errors.push("Invalid price");
    }
  }
  if (!CHAINS[input.chainKey]) errors.push("Unknown chain");
  return errors;
}

export function buildMintTransaction(input: BuildMintInput): CanonicalTx {
  const errors = validateBuildInput(input);
  if (errors.length) throw new Error(errors.join("; "));
  const fn = input.fn ?? "mint";
  const data = encodeFunctionData({
    abi: COMMON_MINT_ABI,
    functionName: fn,
    args: [BigInt(input.quantity)],
  });
  const unit = BigInt(input.priceWeiPerMint ?? "0");
  const value = (unit * BigInt(input.quantity)).toString();
  const confidence: Confidence = input.fn ? "MEDIUM" : "LOW";
  return {
    to: normalizeAddress(input.contract),
    data,
    value,
    chainId: CHAINS[input.chainKey].id,
    contract: normalizeAddress(input.contract),
    wallet: normalizeAddress(input.wallet),
    quantity: input.quantity,
    source: input.source ?? "direct-contract",
    timestamp: Date.now(),
    confidence,
  };
}

export function normalizeExternalTx(raw: Record<string, unknown>, fallback: Partial<CanonicalTx>): CanonicalTx {
  const to = String(raw.to ?? raw.target ?? fallback.to ?? "");
  const data = String(raw.data ?? raw.calldata ?? fallback.data ?? "0x");
  const value = String(raw.value ?? fallback.value ?? "0");
  if (!isHexAddress(to)) throw new Error("External tx missing destination");
  if (!data.startsWith("0x")) throw new Error("External tx calldata is not hex");
  return {
    to: normalizeAddress(to),
    data,
    value,
    chainId: Number(raw.chainId ?? fallback.chainId ?? 0),
    contract: normalizeAddress(String(raw.contract ?? to)),
    wallet: normalizeAddress(String(raw.wallet ?? fallback.wallet ?? to)),
    quantity: Number(raw.quantity ?? fallback.quantity ?? 1),
    source: String(raw.source ?? fallback.source ?? "external"),
    timestamp: Date.now(),
    confidence: "MEDIUM",
  };
}

export function assertSafeTx(tx: CanonicalTx) {
  if (!isHexAddress(tx.to)) throw new Error("Unsafe destination");
  if (tx.to !== tx.contract) throw new Error("Destination does not match contract");
  if (!tx.data.startsWith("0x") || tx.data.length < 10) throw new Error("Calldata too short");
  if (!Number.isFinite(tx.chainId) || tx.chainId <= 0) throw new Error("Invalid chainId");
  if (tx.quantity < 1) throw new Error("Invalid quantity");
  BigInt(tx.value);
}
