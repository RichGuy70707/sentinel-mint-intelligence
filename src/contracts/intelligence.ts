import { toFunctionSelector } from "viem";
import type { MintFn } from "../transactions/builder.ts";

export type MintPrepareState =
  | "READY"
  | "PRICE_UNKNOWN"
  | "INTERFACE_UNKNOWN"
  | "ARGUMENTS_UNKNOWN"
  | "REQUIRES_PROOF"
  | "REQUIRES_VERIFICATION"
  | "SALE_NOT_ACTIVE"
  | "SOLD_OUT";

export interface SafeMintPattern {
  fn: MintFn;
  sig: string;
  selector: string;
  argSemantics: "quantity";
  executable: true;
}

export interface DetectedSelector {
  selector: string;
  sig: string | null;
  fn: MintFn | null;
  source: "PUSH4" | "VERIFIED_ABI" | "SEADROP";
  known: boolean;
  executable: boolean;
  note: string;
}

const SAFE: Omit<SafeMintPattern, "selector">[] = [
  { fn: "mint", sig: "mint(uint256)", argSemantics: "quantity", executable: true },
  { fn: "publicMint", sig: "publicMint(uint256)", argSemantics: "quantity", executable: true },
  { fn: "mintPublic", sig: "mintPublic(uint256)", argSemantics: "quantity", executable: true },
];

const ADMIN_NAME = /^(owner|admin|dev|team|reserve|airdrop|gift|bonus|internal)/i;

export const SAFE_MINT_PATTERNS: SafeMintPattern[] = SAFE.map((p) => ({
  ...p,
  selector: toFunctionSelector(p.sig),
}));

export function isAdminMintName(name: string): boolean {
  return ADMIN_NAME.test(name);
}

export function extractPush4Selectors(bytecode: string): string[] {
  const hex = bytecode.toLowerCase().replace(/^0x/, "");
  if (hex.length < 10) return [];
  const runtime = stripMetadata(hex);
  const found = new Set<string>();
  for (let i = 0; i + 10 <= runtime.length; i += 2) {
    if (runtime.slice(i, i + 2) !== "63") continue;
    const sel = runtime.slice(i + 2, i + 10);
    if (/^[0-9a-f]{8}$/.test(sel)) found.add(`0x${sel}`);
  }
  return [...found];
}

export function matchSafeMintFromBytecode(bytecode: string): DetectedSelector | null {
  const present = new Set(extractPush4Selectors(bytecode));
  for (const pattern of SAFE_MINT_PATTERNS) {
    if (present.has(pattern.selector.toLowerCase())) {
      return {
        selector: pattern.selector,
        sig: pattern.sig,
        fn: pattern.fn,
        source: "PUSH4",
        known: true,
        executable: true,
        note: `${pattern.sig} PUSH4 selector present`,
      };
    }
  }
  return null;
}

export function matchSafeMintFromAbi(abi: Array<{ type?: string; name?: string; inputs?: { type: string }[] }>): DetectedSelector | null {
  const fns = abi.filter((item) => item.type === "function" && item.name);
  for (const pattern of SAFE_MINT_PATTERNS) {
    const hit = fns.find(
      (item) =>
        item.name === pattern.fn &&
        (item.inputs ?? []).length === 1 &&
        (item.inputs?.[0]?.type === "uint256" || item.inputs?.[0]?.type === "uint"),
    );
    if (hit && !isAdminMintName(hit.name ?? "")) {
      return {
        selector: pattern.selector,
        sig: pattern.sig,
        fn: pattern.fn,
        source: "VERIFIED_ABI",
        known: true,
        executable: true,
        note: `Verified ABI ${pattern.sig}`,
      };
    }
  }
  const ambiguous = fns.find((item) => /mint/i.test(item.name ?? "") && !isAdminMintName(item.name ?? ""));
  if (ambiguous) {
    return {
      selector: "0x00000000",
      sig: `${ambiguous.name}(${(ambiguous.inputs ?? []).map((i) => i.type).join(",")})`,
      fn: null,
      source: "VERIFIED_ABI",
      known: false,
      executable: false,
      note: "Mint-like ABI present but argument semantics are not in the allowlist",
    };
  }
  return null;
}

function stripMetadata(hex: string): string {
  const cbor = hex.lastIndexOf("a2646970667358");
  if (cbor > 64) return hex.slice(0, cbor);
  return hex;
}
