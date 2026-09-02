import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveStagesFromIntel, resolveMintStatus } from "./engine.ts";

describe("stage derivation", () => {
  it("does not invent a start time from missing sale windows", () => {
    const stages = deriveStagesFromIntel({ projectId: "p", publicStart: null, priceWei: null });
    assert.equal(stages[0]?.startTime, null);
    assert.equal(stages[0]?.endTime, null);
    assert.match(stages[0]?.provenance.note ?? "", /not inferred/);
  });

  it("rejects epoch zeros", () => {
    const stages = deriveStagesFromIntel({ projectId: "p", publicStart: 0, publicEnd: 0 });
    assert.equal(stages[0]?.startTime, null);
    assert.equal(stages[0]?.endTime, null);
  });

  it("marks merkle when a non-zero root is evidenced", () => {
    const stages = deriveStagesFromIntel({ projectId: "p", merkleRoot: true });
    assert.equal(stages[0]?.kind, "MERKLE");
    assert.equal(stages[0]?.requiresVerification, true);
  });

  it("keeps LIVE from mint activity when the sale window is unread", () => {
    assert.equal(resolveMintStatus([{ startTime: null, endTime: null }], { minted: 12 }), "LIVE");
    assert.equal(resolveMintStatus([{ startTime: null, endTime: null }], { minted: 0 }), "UNKNOWN");
  });
});
