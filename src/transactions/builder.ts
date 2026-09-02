import { encodeFunctionData } from "viem";
import { isHexAddress, normalizeAddress } from "../core/address.ts";
import type { CanonicalTx, ChainKey } from "../core/types.ts";
import { CHAINS } from "../chains/registry.ts";
import { COMMON_MINT_ABI } from "../contracts/abi.ts";

export const SEADROP_ADDRESS = "0x00005ea00ac477b1030ce78506496e8c2de24bf5";

export type MintFn = "mint" | "publicMint" | "mintPublic";

export interface BuildMintInput {
  chainKey: ChainKey;
  contract: string;
  wallet: string;
  quantity: number;
  priceWeiPerMint: string | null;
  fn?: MintFn;
  source?: string;
  seadrop?: boolean;
}

export class PrepareError extends Error {
  code: "PRICE_UNKNOWN" | "INTERFACE_UNKNOWN" | "INVALID" | "ARGUMENTS_UNKNOWN" | "REQUIRES_PROOF" | "SALE_NOT_ACTIVE" | "SOLD_OUT";
  constructor(code: PrepareError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "PrepareError";
  }
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
  if (errors.length) throw new PrepareError("INVALID", errors.join("; "));
  if (input.priceWeiPerMint == null) {
    throw new PrepareError("PRICE_UNKNOWN", "Mint price is unread. Refusing to encode value 0.");
  }
  if (input.seadrop) return buildSeadropTx(input);
  if (!input.fn) {
    throw new PrepareError(
      "INTERFACE_UNKNOWN",
      "Mint selector is not evidenced. Refusing to assume mint().",
    );
  }
  const data = encodeFunctionData({
    abi: COMMON_MINT_ABI,
    functionName: input.fn,
    args: [BigInt(input.quantity)],
  });
  const unit = BigInt(input.priceWeiPerMint);
  const value = (unit * BigInt(input.quantity)).toString();
  return {
    to: normalizeAddress(input.contract),
    data,
    value,
    chainId: CHAINS[input.chainKey].id,
    contract: normalizeAddress(input.contract),
    wallet: normalizeAddress(input.wallet),
    quantity: input.quantity,
    source: input.source ?? `direct-contract.${input.fn}`,
    timestamp: Date.now(),
    confidence: "MEDIUM",
  };
}

function buildSeadropTx(input: BuildMintInput): CanonicalTx {
  const data = encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "mintPublic",
        stateMutability: "payable",
        inputs: [
          { name: "nftContract", type: "address" },
          { name: "feeRecipient", type: "address" },
          { name: "minterIfNotPayer", type: "address" },
          { name: "quantity", type: "uint256" },
        ],
        outputs: [],
      },
    ],
    functionName: "mintPublic",
    args: [
      input.contract as `0x${string}`,
      "0x0000000000000000000000000000000000000000",
      input.wallet as `0x${string}`,
      BigInt(input.quantity),
    ],
  });
  const unit = BigInt(input.priceWeiPerMint ?? "0");
  return {
    to: SEADROP_ADDRESS,
    data,
    value: (unit * BigInt(input.quantity)).toString(),
    chainId: CHAINS[input.chainKey].id,
    contract: SEADROP_ADDRESS,
    wallet: normalizeAddress(input.wallet),
    quantity: input.quantity,
    source: "seadrop.mintPublic",
    timestamp: Date.now(),
    confidence: "HIGH",
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
  if (tx.source.startsWith("seadrop")) {
    if (tx.to !== SEADROP_ADDRESS) throw new Error("SeaDrop destination mismatch");
  } else if (tx.to !== tx.contract) {
    throw new Error("Destination does not match contract");
  }
  if (!tx.data.startsWith("0x") || tx.data.length < 10) throw new Error("Calldata too short");
  if (!Number.isFinite(tx.chainId) || tx.chainId <= 0) throw new Error("Invalid chainId");
  if (tx.quantity < 1) throw new Error("Invalid quantity");
  BigInt(tx.value);
}
