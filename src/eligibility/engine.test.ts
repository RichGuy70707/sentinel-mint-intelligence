import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProjectModel, StageModel, WalletRecord } from "../core/types.ts";
import { evaluateWalletStage, isolateCacheKey } from "./engine.ts";

const wallet: WalletRecord = {
  id: "w1",
  name: "MAIN",
  address: "0x1111111111111111111111111111111111111111",
  notes: "",
  tags: [],
  enabled: true,
  favorite: true,
  priority: 1,
  createdAt: 1,
};

function stage(over: Partial<StageModel> = {}): StageModel {
  return {
    id: "s",
    kind: "PUBLIC",
    label: "Public",
    mechanism: "PUBLIC",
    mechanismConfidence: "DERIVED",
    startTime: Date.now() - 10,
    endTime: Date.now() + 10_000,
    priceWei: "0",
    maxPerWallet: 1,
    maxSupply: null,
    requiresVerification: false,
    provenance: { source: "DERIVED", quality: "UNKNOWN", confidence: "LOW", fetchedAt: 1, ttlMs: 1 },
    ...over,
  };
}

const project = { id: "p1" } as ProjectModel;

describe("eligibility", () => {
  it("marks public live stages eligible", () => {
    const r = evaluateWalletStage(wallet, project, stage());
    assert.equal(r.status, "ELIGIBLE");
  });

  it("does not invent merkle proofs", () => {
    const r = evaluateWalletStage(wallet, project, stage({ kind: "MERKLE", mechanism: "MERKLE" }));
    assert.equal(r.status, "REQUIRES_PROOF");
  });

  it("uses on-chain gate balances when provided", () => {
    const yes = evaluateWalletStage(wallet, project, stage({ kind: "NFT_GATED" }), { nftBalance: 2 });
    const no = evaluateWalletStage(wallet, project, stage({ kind: "NFT_GATED" }), { nftBalance: 0 });
    assert.equal(yes.status, "ELIGIBLE");
    assert.equal(no.status, "NOT_ELIGIBLE");
  });

  it("isolates cache keys by wallet and chain", () => {
    const a = isolateCacheKey(1, "p", "0x1111111111111111111111111111111111111111", "s");
    const b = isolateCacheKey(4663, "p", "0x1111111111111111111111111111111111111111", "s");
    const c = isolateCacheKey(1, "p", "0x2222222222222222222222222222222222222222", "s");
    assert.notEqual(a, b);
    assert.notEqual(a, c);
  });
});
