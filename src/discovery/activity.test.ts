import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeMintLogs, saneSupply, velocityPerMin } from "./activity.ts";

describe("discovery activity math", () => {
  it("dedupes identical mint logs", () => {
    const log = { transactionHash: "0xabc", address: "0x1", topics: ["0xa", "0xb"] };
    assert.equal(dedupeMintLogs([log, { ...log }, { ...log, transactionHash: "0xdef" }]).length, 2);
  });

  it("does not invent velocity without a window", () => {
    assert.equal(velocityPerMin(10, null), null);
    assert.equal(velocityPerMin(10, 0), null);
    assert.equal(velocityPerMin(10, 5), 2);
    assert.equal(velocityPerMin(0, 5), 0);
  });

  it("rejects implausible supply values", () => {
    assert.equal(saneSupply(10_000), 10_000);
    assert.equal(saneSupply(80_000_000), null);
    assert.equal(saneSupply(Number.NaN), null);
    assert.equal(saneSupply(-1), null);
  });
});
