import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isolateCacheKey } from "../eligibility/engine.ts";
import { normalizeAddress } from "./address.ts";

describe("wallet isolation", () => {
  it("never lets wallet A answer for wallet B", () => {
    const a = isolateCacheKey(1, "proj", "0x1111111111111111111111111111111111111111", "pub");
    const b = isolateCacheKey(1, "proj", "0x2222222222222222222222222222222222222222", "pub");
    assert.notEqual(a, b);
    assert.match(a, /0x1111/);
  });

  it("never lets ethereum cache answer robinhood", () => {
    const eth = isolateCacheKey(1, "proj", "0x1111111111111111111111111111111111111111", "pub");
    const rh = isolateCacheKey(4663, "proj", "0x1111111111111111111111111111111111111111", "pub");
    assert.notEqual(eth, rh);
  });

  it("normalizes before keying", () => {
    assert.equal(
      isolateCacheKey(1, "p", "0xAAAaaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "s"),
      isolateCacheKey(1, "p", "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "s"),
    );
    assert.equal(normalizeAddress("0xAAAaaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"), "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });
});
