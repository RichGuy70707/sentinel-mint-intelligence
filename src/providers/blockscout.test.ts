import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMintTransfer, tokenAddress, type BlockscoutTransfer } from "./blockscout.ts";

describe("blockscout mint filter", () => {
  it("treats zero-from and token_minting as mints", () => {
    const minting: BlockscoutTransfer = { type: "token_minting", token: { address_hash: "0x" + "ab".repeat(20) } };
    const zero: BlockscoutTransfer = {
      type: "token_transfer",
      from: { hash: "0x0000000000000000000000000000000000000000" },
      token: { address: "0x" + "cd".repeat(20) },
    };
    const sale: BlockscoutTransfer = {
      type: "token_transfer",
      from: { hash: "0x1111111111111111111111111111111111111111" },
      token: { address: "0x" + "ee".repeat(20) },
    };
    assert.equal(isMintTransfer(minting), true);
    assert.equal(isMintTransfer(zero), true);
    assert.equal(isMintTransfer(sale), false);
    assert.equal(tokenAddress(minting), "0xabababababababababababababababababababab");
  });
});
