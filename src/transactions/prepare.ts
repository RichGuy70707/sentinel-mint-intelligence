import type { ChainKey } from "@/core/types";
import { probeSale } from "@/contracts/sale";
import { detectPublicMintFn } from "@/contracts/selectors";
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
