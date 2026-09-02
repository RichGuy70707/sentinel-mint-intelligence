import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toFunctionSelector } from "viem";
import {
  extractPush4Selectors,
  isAdminMintName,
  matchSafeMintFromAbi,
  matchSafeMintFromBytecode,
} from "./intelligence.ts";

describe("contract intelligence", () => {
  it("extracts PUSH4 selectors and ignores PUSH20", () => {
    const mint = toFunctionSelector("mint(uint256)").slice(2);
    const code = `0x6080604063${mint}0073${mint}00`;
    const sels = extractPush4Selectors(code);
    assert.ok(sels.includes(`0x${mint}`));
    assert.equal(matchSafeMintFromBytecode(code)?.fn, "mint");
    assert.equal(matchSafeMintFromBytecode(`0x73${mint}`)?.fn, undefined);
  });

  it("does not treat admin mint ABI as executable", () => {
    assert.equal(isAdminMintName("ownerMint"), true);
    assert.equal(isAdminMintName("mint"), false);
    const hit = matchSafeMintFromAbi([
      { type: "function", name: "ownerMint", inputs: [{ type: "uint256" }] },
      { type: "function", name: "mint", inputs: [{ type: "address" }, { type: "uint256" }] },
    ]);
    assert.equal(hit?.executable, false);
    assert.equal(hit?.fn, null);
  });

  it("accepts verified mint(uint256) ABI", () => {
    const hit = matchSafeMintFromAbi([{ type: "function", name: "mint", inputs: [{ type: "uint256" }] }]);
    assert.equal(hit?.fn, "mint");
    assert.equal(hit?.executable, true);
    assert.equal(hit?.source, "VERIFIED_ABI");
  });
});
