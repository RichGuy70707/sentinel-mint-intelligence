import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { preferName, reconcileSupply } from "./quality.ts";

describe("discovery quality", () => {
  it("drops conflicting supply when minted exceeds cap", () => {
    assert.deepEqual(reconcileSupply(12_421, 5_555), { minted: 12_421, supply: null });
    assert.deepEqual(reconcileSupply(12, 5_555), { minted: 12, supply: 5_555 });
    assert.deepEqual(reconcileSupply(10, null), { minted: 10, supply: null });
  });

  it("never invents a project name from an address", () => {
    assert.equal(preferName("0xabc", "UNKNOWN PROJECT", null), "UNKNOWN PROJECT");
    assert.equal(preferName("Based Joyride", "0xabc"), "Based Joyride");
  });
});
