import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSafeTx, buildMintTransaction, normalizeExternalTx, PrepareError, validateBuildInput } from "./builder.ts";

describe("tx builder", () => {
  it("rejects bad addresses and quantities", () => {
    const errors = validateBuildInput({
      chainKey: "eth",
      contract: "nope",
      wallet: "nope",
      quantity: 0,
      priceWeiPerMint: "0",
    });
    assert.ok(errors.length >= 3);
  });

  it("refuses to encode unknown price as zero", () => {
    assert.throws(
      () =>
        buildMintTransaction({
          chainKey: "eth",
          contract: "0x1111111111111111111111111111111111111111",
          wallet: "0x2222222222222222222222222222222222222222",
          quantity: 1,
          priceWeiPerMint: null,
          fn: "mint",
        }),
      (err: unknown) => err instanceof PrepareError && err.code === "PRICE_UNKNOWN",
    );
  });

  it("refuses to assume mint() without an evidenced selector", () => {
    assert.throws(
      () =>
        buildMintTransaction({
          chainKey: "eth",
          contract: "0x1111111111111111111111111111111111111111",
          wallet: "0x2222222222222222222222222222222222222222",
          quantity: 1,
          priceWeiPerMint: "0",
        }),
      (err: unknown) => err instanceof PrepareError && err.code === "INTERFACE_UNKNOWN",
    );
  });

  it("builds canonical mint calldata when selector and price are evidenced", () => {
    const tx = buildMintTransaction({
      chainKey: "eth",
      contract: "0x1111111111111111111111111111111111111111",
      wallet: "0x2222222222222222222222222222222222222222",
      quantity: 2,
      priceWeiPerMint: "1000",
      fn: "mint",
    });
    assert.equal(tx.chainId, 1);
    assert.equal(tx.value, "2000");
    assert.match(tx.data, /^0x/);
    assertSafeTx(tx);
  });

  it("builds SeaDrop mintPublic against the protocol address", () => {
    const tx = buildMintTransaction({
      chainKey: "eth",
      contract: "0x1111111111111111111111111111111111111111",
      wallet: "0x2222222222222222222222222222222222222222",
      quantity: 1,
      priceWeiPerMint: "0",
      seadrop: true,
    });
    assert.equal(tx.to, "0x00005ea00ac477b1030ce78506496e8c2de24bf5");
    assert.equal(tx.source, "seadrop.mintPublic");
    assertSafeTx(tx);
  });

  it("normalizes target/calldata shapes", () => {
    const tx = normalizeExternalTx(
      { target: "0x1111111111111111111111111111111111111111", calldata: "0xabcdef00", value: "1" },
      { chainId: 1, wallet: "0x2222222222222222222222222222222222222222", quantity: 1 },
    );
    assert.equal(tx.to, "0x1111111111111111111111111111111111111111");
    assert.equal(tx.data, "0xabcdef00");
  });
});
