import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSafeTx, buildMintTransaction, normalizeExternalTx, validateBuildInput } from "./builder.ts";

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

  it("builds canonical mint calldata", () => {
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

  it("normalizes target/calldata shapes", () => {
    const tx = normalizeExternalTx(
      { target: "0x1111111111111111111111111111111111111111", calldata: "0xabcdef00", value: "1" },
      { chainId: 1, wallet: "0x2222222222222222222222222222222222222222", quantity: 1 },
    );
    assert.equal(tx.to, "0x1111111111111111111111111111111111111111");
    assert.equal(tx.data, "0xabcdef00");
  });
});
