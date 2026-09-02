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
    const yes = evaluateWalletStage(wallet, project, stage({ kind: "NFT_GATED", gateContract: "0x3333333333333333333333333333333333333333" }), { gateTokenBalance: 2 });
    const no = evaluateWalletStage(wallet, project, stage({ kind: "NFT_GATED", gateContract: "0x3333333333333333333333333333333333333333" }), { gateTokenBalance: 0 });
    assert.equal(yes.status, "ELIGIBLE");
    assert.equal(no.status, "NOT_ELIGIBLE");
  });

  it("marks public wallets over maxPerWallet as not eligible", () => {
    const r = evaluateWalletStage(wallet, project, stage({ maxPerWallet: 1 }), { nftBalance: 1 });
    assert.equal(r.status, "NOT_ELIGIBLE");
    assert.match(r.reason, /cap/);
  });

  it("keeps a public wallet eligible when under the evidenced cap", () => {
    const r = evaluateWalletStage(wallet, project, stage({ maxPerWallet: 3 }), { nftBalance: 1 });
    assert.equal(r.status, "ELIGIBLE");
    assert.match(r.reason, /remaining/);
  });

  it("rejects insufficient native balance when price is evidenced", () => {
    const r = evaluateWalletStage(
      wallet,
      project,
      stage({ priceWei: "1000000000000000000" }),
      { nativeBalanceWei: "1" },
    );
    assert.equal(r.status, "NOT_ELIGIBLE");
    assert.match(r.reason, /Insufficient/);
  });

  it("does not mark paid public as ELIGIBLE when balance is unread", () => {
    const r = evaluateWalletStage(wallet, project, stage({ priceWei: "1000000000000000000" }), {});
    assert.equal(r.status, "UNKNOWN");
  });

  it("evaluates two wallets independently", () => {
    const burner: WalletRecord = { ...wallet, id: "w2", name: "BURNER", address: "0x2222222222222222222222222222222222222222" };
    const a = evaluateWalletStage(wallet, project, stage({ maxPerWallet: 1 }), { nftBalance: 0 });
    const b = evaluateWalletStage(burner, project, stage({ maxPerWallet: 1 }), { nftBalance: 1 });
    assert.equal(a.status, "ELIGIBLE");
    assert.equal(b.status, "NOT_ELIGIBLE");
    assert.notEqual(a.walletAddress, b.walletAddress);
  });

  it("does not treat collection balance as an unevidenced NFT gate", () => {
    const r = evaluateWalletStage(wallet, project, stage({ kind: "NFT_GATED" }), { nftBalance: 4 });
    assert.equal(r.status, "REQUIRES_VERIFICATION");
  });

  it("does not invent merkle proofs for WL / presale labels", () => {
    const r = evaluateWalletStage(wallet, project, stage({ kind: "WL", mechanism: "WL" }));
    assert.equal(r.status, "REQUIRES_PROOF");
  });

  it("uses gateTokenBalance when the gate is a different collection", () => {
    const gated = stage({
      kind: "NFT_GATED",
      gateContract: "0x3333333333333333333333333333333333333333",
    });
    const mintProject = { id: "p1", contract: "0x4444444444444444444444444444444444444444" } as ProjectModel;
    const no = evaluateWalletStage(wallet, mintProject, gated, { nftBalance: 9, gateTokenBalance: 0 });
    const yes = evaluateWalletStage(wallet, mintProject, gated, { nftBalance: 0, gateTokenBalance: 2 });
    assert.equal(no.status, "NOT_ELIGIBLE");
    assert.equal(yes.status, "ELIGIBLE");
  });

  it("isolates cache keys by wallet and chain", () => {
    const a = isolateCacheKey(1, "p", "0x1111111111111111111111111111111111111111", "s");
    const b = isolateCacheKey(4663, "p", "0x1111111111111111111111111111111111111111", "s");
    const c = isolateCacheKey(1, "p", "0x2222222222222222222222222222222222222222", "s");
    assert.notEqual(a, b);
    assert.notEqual(a, c);
  });
});
