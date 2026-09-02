import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  boardEmptyCopy,
  compactChainErrors,
  deriveTerminalPhase,
  nextHintMap,
} from "./terminal.ts";

describe("terminal phase", () => {
  it("marks an in-flight scan as SCANNING even if a catalog already exists", () => {
    assert.equal(
      deriveTerminalPhase({
        scanning: true,
        sessionFresh: false,
        scanFailed: false,
        liveCount: 3,
        errorCount: 0,
      }),
      "SCANNING",
    );
  });

  it("does not treat a stale persisted catalog as LIVE", () => {
    assert.equal(
      deriveTerminalPhase({
        scanning: false,
        sessionFresh: false,
        scanFailed: false,
        liveCount: 12,
        errorCount: 0,
      }),
      "IDLE",
    );
  });

  it("marks a successful scan with evidenced activity as LIVE", () => {
    assert.equal(
      deriveTerminalPhase({
        scanning: false,
        sessionFresh: true,
        scanFailed: false,
        liveCount: 2,
        errorCount: 0,
      }),
      "LIVE",
    );
  });

  it("marks an empty completed scan as EMPTY", () => {
    assert.equal(
      deriveTerminalPhase({
        scanning: false,
        sessionFresh: true,
        scanFailed: false,
        liveCount: 0,
        errorCount: 0,
      }),
      "EMPTY",
    );
  });

  it("marks partial provider failure as DEGRADED", () => {
    assert.equal(
      deriveTerminalPhase({
        scanning: false,
        sessionFresh: true,
        scanFailed: false,
        liveCount: 1,
        errorCount: 1,
      }),
      "DEGRADED",
    );
    assert.equal(
      deriveTerminalPhase({
        scanning: false,
        sessionFresh: true,
        scanFailed: false,
        liveCount: 0,
        errorCount: 1,
      }),
      "DEGRADED",
    );
  });

  it("marks a failed or fully-broken scan as ERROR", () => {
    assert.equal(
      deriveTerminalPhase({
        scanning: false,
        sessionFresh: true,
        scanFailed: true,
        liveCount: 0,
        errorCount: 0,
      }),
      "ERROR",
    );
    assert.equal(
      deriveTerminalPhase({
        scanning: false,
        sessionFresh: true,
        scanFailed: false,
        liveCount: 0,
        errorCount: 4,
      }),
      "ERROR",
    );
  });

  it("marks a timed-out first scan as ERROR, not SCANNING or LIVE", () => {
    assert.equal(
      deriveTerminalPhase({
        scanning: false,
        sessionFresh: false,
        scanFailed: true,
        liveCount: 0,
        errorCount: 0,
      }),
      "ERROR",
    );
  });

  it("keeps prior live rows as DEGRADED when a later scan times out", () => {
    assert.equal(
      deriveTerminalPhase({
        scanning: false,
        sessionFresh: true,
        scanFailed: true,
        liveCount: 4,
        errorCount: 0,
      }),
      "DEGRADED",
    );
  });

  it("keeps raw provider messages out of the board compact line", () => {
    const line = compactChainErrors([{ chainKey: "base", message: "Blockscout HTTP 500" }]);
    assert.equal(line, "BASE degraded");
    assert.ok(line && !line.includes("500"));
    assert.ok(line && !line.includes("Blockscout"));
  });

  it("uses coherent empty-board copy per phase", () => {
    assert.match(boardEmptyCopy("EMPTY"), /No evidenced mint activity/);
    assert.match(boardEmptyCopy("ERROR"), /Health/);
    assert.match(boardEmptyCopy("DEGRADED"), /degraded/i);
    assert.match(boardEmptyCopy("IDLE"), /first scan/);
  });
});

describe("hint map state", () => {
  it("does not allocate a new object when already cleared", () => {
    const empty = {};
    assert.equal(nextHintMap(empty, {}, true), empty);
    let prev = empty;
    for (let i = 0; i < 50; i++) {
      const next = nextHintMap(prev, {}, true);
      assert.equal(next, prev);
      prev = next;
    }
  });

  it("does not allocate when incoming hints are equal", () => {
    const prev = { w1: { nftBalance: 1 } };
    const same = nextHintMap(prev, { w1: { nftBalance: 1 } }, false);
    assert.equal(same, prev);
  });

  it("replaces when the project/wallet snapshot changes", () => {
    const prev = { w1: { nftBalance: 1 } };
    const next = nextHintMap(prev, { w1: { nftBalance: 2 } }, false);
    assert.notEqual(next, prev);
    assert.equal(next.w1?.nftBalance, 2);
  });
});
