import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isProtocolReceiptNft } from "./noise.ts";

describe("protocol receipt filter", () => {
  it("flags uniswap position and namewrapper tokens", () => {
    assert.equal(isProtocolReceiptNft({ name: "Uniswap V3 Positions NFT-V1", symbol: "UNI-V3-POS" }), true);
    assert.equal(isProtocolReceiptNft({ name: "NameWrapper", symbol: "ENS" }), true);
    assert.equal(isProtocolReceiptNft({ name: "Slipstream Position NFT v1.2", symbol: "SLIP" }), true);
    assert.equal(
      isProtocolReceiptNft({ contract: "0xc36442b4a4522e871399cd717abdd847ab11fe88" }),
      true,
    );
  });

  it("does not flag ordinary collections", () => {
    assert.equal(isProtocolReceiptNft({ name: "Pudgy Penguins", symbol: "PPG" }), false);
    assert.equal(isProtocolReceiptNft({ name: "Based God Blaze It", symbol: "BGBI" }), false);
  });
});
