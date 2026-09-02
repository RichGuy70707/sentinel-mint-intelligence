import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyActivity, trendScore } from "./activity-kind.ts";

describe("activity kind", () => {
  it("treats one transaction minting thousands as BULK", () => {
    assert.equal(classifyActivity({ windowMints: 9000, uniqueMinters: 1, mintTxCount: 1 }), "BULK");
    assert.equal(classifyActivity({ windowMints: 12, uniqueMinters: 10, mintTxCount: 11 }), "NORMAL");
    assert.equal(classifyActivity({ windowMints: null, uniqueMinters: null, mintTxCount: null }), "UNKNOWN");
  });

  it("does not let bulk velocity dominate organic trending", () => {
    const bulk = trendScore({ velocity: 562, uniqueMinters: 1, activityKind: "BULK" });
    const organic = trendScore({ velocity: 12, uniqueMinters: 18, activityKind: "NORMAL" });
    assert.ok(organic > bulk);
  });
});
