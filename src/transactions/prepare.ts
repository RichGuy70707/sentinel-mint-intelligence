import type { ChainKey } from "@/core/types";
import { matchSafeMintFromAbi } from "@/contracts/intelligence";
import { probeSale } from "@/contracts/sale";
import { detectPublicMintFn } from "@/contracts/selectors";
import { fetchVerifiedAbi } from "@/contracts/verified-abi";
import { saleWindowGate } from "@/execution/guards";
import { ethGetCode } from "@/providers/rpc";
import { buildMintTransaction, PrepareError, type BuildMintInput } from "./builder";

export interface PrepareOk {
  ok: true;
  tx: ReturnType<typeof buildMintTransaction>;
  warnings: string[];
}

export interface PrepareFail {
  ok: false;
  code: PrepareError["code"];
  reason: string;
}

export async function prepareMintFromEvidence(
  input: Omit<BuildMintInput, "fn" | "seadrop" | "source">,
): Promise<PrepareOk | PrepareFail> {
  const sale = await probeSale(input.chainKey as ChainKey, input.contract);
  const window = saleWindowGate(sale);
  if (!window.ok) return window;
  if (sale.merkleRoot && !sale.seadrop && sale.priceWei == null) {
    return {
      ok: false,
      code: "REQUIRES_PROOF",
      reason: "Allowlist / Merkle root is evidenced and no public price interface was read.",
    };
  }
  const price = sale.priceWei ?? input.priceWeiPerMint;
  if (price == null) {
    return {
      ok: false,
      code: "PRICE_UNKNOWN",
      reason: "On-chain mint price is unread. SENTINEL will not encode value 0.",
    };
  }

  if (sale.seadrop) {
    if (sale.restrictFeeRecipients) {
      return {
        ok: false,
        code: "INTERFACE_UNKNOWN",
        reason: "SeaDrop drop restricts fee recipients. Fee recipient is not evidenced.",
      };
    }
    try {
      const tx = buildMintTransaction({
        ...input,
        priceWeiPerMint: price,
        seadrop: true,
        source: "seadrop.getPublicDrop",
      });
      return { ok: true, tx, warnings: [`Price source ${sale.source}`] };
    } catch (err) {
      if (err instanceof PrepareError) return { ok: false, code: err.code, reason: err.message };
      return { ok: false, code: "INVALID", reason: err instanceof Error ? err.message : "Prepare failed" };
    }
  }

  let bytecode = "0x";
  try {
    bytecode = await ethGetCode(input.chainKey as ChainKey, input.contract);
  } catch {
    return {
      ok: false,
      code: "INTERFACE_UNKNOWN",
      reason: "Could not read contract bytecode to evidence a mint selector.",
    };
  }
  const verified = await fetchVerifiedAbi(input.chainKey as ChainKey, input.contract).catch(() => null);
  if (verified?.verified && verified.abi.length) {
    const fromAbi = matchSafeMintFromAbi(verified.abi);
    if (fromAbi && !fromAbi.executable) {
      return { ok: false, code: "ARGUMENTS_UNKNOWN", reason: fromAbi.note };
    }
    if (fromAbi?.fn) {
      try {
        const tx = buildMintTransaction({
          ...input,
          priceWeiPerMint: price,
          fn: fromAbi.fn,
          source: fromAbi.note,
        });
        return { ok: true, tx, warnings: [fromAbi.note, `Price source ${sale.source}`] };
      } catch (err) {
        if (err instanceof PrepareError) return { ok: false, code: err.code, reason: err.message };
        return { ok: false, code: "INVALID", reason: err instanceof Error ? err.message : "Prepare failed" };
      }
    }
  }
  const fn = detectPublicMintFn(bytecode);
  if (!fn) {
    return {
      ok: false,
      code: "INTERFACE_UNKNOWN",
      reason: `No evidenced public mint selector in bytecode (sale source: ${sale.source}).`,
    };
  }
  try {
    const tx = buildMintTransaction({
      ...input,
      priceWeiPerMint: price,
      fn,
      source: `bytecode.${fn}`,
    });
    return { ok: true, tx, warnings: [`Selector ${fn} evidenced in bytecode`, `Price source ${sale.source}`] };
  } catch (err) {
    if (err instanceof PrepareError) return { ok: false, code: err.code, reason: err.message };
    return { ok: false, code: "INVALID", reason: err instanceof Error ? err.message : "Prepare failed" };
  }
}
