import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifySimFailure } from "./classify.ts";

describe("simulation classification", () => {
  it("does not treat provider timeout as a mint revert", () => {
    assert.equal(classifySimFailure("Provider timeout after 8000ms"), "SIMULATION_PROVIDER_ERROR");
    assert.equal(classifySimFailure("HTTP 502"), "SIMULATION_PROVIDER_ERROR");
  });

  it("classifies execution revert as a contract revert", () => {
    assert.equal(classifySimFailure("execution reverted: NotLive"), "SIMULATION_REVERT");
  });
});
