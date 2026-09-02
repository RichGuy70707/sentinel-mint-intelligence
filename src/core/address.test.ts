import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHexAddress, isZeroAddress, normalizeAddress, shortAddress, ZERO_ADDRESS } from "./address.ts";

describe("address", () => {
  it("accepts checksum and lower hex", () => {
    assert.equal(isHexAddress("0x742d35Cc6634C0532925a3b844Bc454e4438f44e"), true);
    assert.equal(normalizeAddress("0x742d35Cc6634C0532925a3b844Bc454e4438f44e"), "0x742d35cc6634c0532925a3b844bc454e4438f44e");
  });

  it("rejects short values", () => {
    assert.equal(isHexAddress("0x123"), false);
    assert.throws(() => normalizeAddress("not-an-address"));
  });

  it("detects zero and shortens", () => {
    assert.equal(isZeroAddress(ZERO_ADDRESS), true);
    assert.match(shortAddress(ZERO_ADDRESS), /0x0000/);
  });
});
