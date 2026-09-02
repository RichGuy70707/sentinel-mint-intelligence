import { toFunctionSelector } from "viem";
import type { MintFn } from "../transactions/builder.ts";
import { extractPush4Selectors, matchSafeMintFromBytecode } from "./intelligence.ts";

export function selectorFor(sig: string): string {
  return toFunctionSelector(sig);
}

export function bytecodeHasSelector(bytecode: string, selector: string): boolean {
  const sel = selector.toLowerCase().replace(/^0x/, "");
  if (sel.length !== 8) return false;
  return extractPush4Selectors(bytecode).includes(`0x${sel}`);
}

/** Only returns a mint fn when a safe allowlisted PUSH4 selector is present. */
export function detectPublicMintFn(bytecode: string): MintFn | null {
  return matchSafeMintFromBytecode(bytecode)?.fn ?? null;
}
