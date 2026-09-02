import { toFunctionSelector } from "viem";
import type { MintFn } from "../transactions/builder.ts";

const CANDIDATES: { fn: MintFn; sig: string }[] = [
  { fn: "mint", sig: "mint(uint256)" },
  { fn: "publicMint", sig: "publicMint(uint256)" },
  { fn: "mintPublic", sig: "mintPublic(uint256)" },
];

export function selectorFor(sig: string): string {
  return toFunctionSelector(sig);
}

export function bytecodeHasSelector(bytecode: string, selector: string): boolean {
  const hex = bytecode.toLowerCase().replace(/^0x/, "");
  if (hex.length < 8 || hex === "0" || hex === "") return false;
  const sel = selector.toLowerCase().replace(/^0x/, "");
  if (sel.length !== 8) return false;
  return hex.includes(`63${sel}`) || hex.includes(`73${sel}`);
}

/** Only returns a mint fn when its 4-byte selector is present in runtime bytecode. */
export function detectPublicMintFn(bytecode: string): MintFn | null {
  for (const c of CANDIDATES) {
    if (bytecodeHasSelector(bytecode, selectorFor(c.sig))) return c.fn;
  }
  return null;
}
