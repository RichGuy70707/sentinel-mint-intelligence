import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { preferName, reconcileSupply, splitMintStats } from "./quality.ts";

describe("discovery quality", () => {
  it("drops conflicting supply when minted exceeds cap", () => {
    assert.deepEqual(reconcileSupply(12_421, 5_555), { minted: 12_421, supply: null });
    assert.deepEqual(reconcileSupply(12, 5_555), { minted: 12, supply: 5_555 });
    assert.deepEqual(reconcileSupply(10, null), { minted: 10, supply: null });
  });

  it("rejects OpenSea placeholder identities", () => {
    assert.equal(
      preferName("Unidentified contract f7e13e89-e113-4009-8eaa-09ed7a57807e", "UNKNOWN PROJECT"),
      "UNKNOWN PROJECT",
    );
    assert.equal(preferName("Unknown contract", "Breeze"), "Breeze");
    assert.equal(preferName("Based Joyride"), "Based Joyride");
    assert.equal(preferName("0xabc", "UNKNOWN PROJECT", null), "UNKNOWN PROJECT");
  });

  it("keeps lifetime minted separate from scan-window activity", () => {
    const split = splitMintStats({ totalSupply: 3_777_484, windowMints: 12, maxSupply: 5_555 });
    assert.equal(split.minted, 3_777_484);
    assert.equal(split.windowMints, 12);
    assert.equal(split.supply, null);
    assert.deepEqual(splitMintStats({ totalSupply: null, windowMints: 18, maxSupply: 1000 }), {
      minted: null,
      windowMints: 18,
      supply: 1000,
    });
  });
});
