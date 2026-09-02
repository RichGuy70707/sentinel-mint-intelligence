import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { injectedMatchesNamed, saleWindowGate } from "./guards.ts";

describe("execution guards", () => {
  it("refuses upcoming and ended sale windows", () => {
    const now = 1_000_000;
    assert.equal(saleWindowGate({ startTime: now + 10_000, endTime: now + 20_000, seadrop: true, priceWei: "0" }, now).ok, false);
    assert.equal(saleWindowGate({ startTime: now - 20_000, endTime: now - 1_000, seadrop: true, priceWei: "0" }, now).ok, false);
    assert.equal(saleWindowGate({ startTime: now - 1_000, endTime: now + 10_000, seadrop: true, priceWei: "0" }, now).ok, true);
  });

  it("allows an unread window when no start/end was evidenced", () => {
    assert.equal(saleWindowGate({ startTime: null, endTime: null, seadrop: false, priceWei: "1" }).ok, true);
  });

  it("requires injected account to match the named wallet", () => {
    assert.equal(
      injectedMatchesNamed("0xAAA1111111111111111111111111111111111111", "0xaaa1111111111111111111111111111111111111"),
      true,
    );
    assert.equal(
      injectedMatchesNamed("0xbbb1111111111111111111111111111111111111", "0xaaa1111111111111111111111111111111111111"),
      false,
    );
  });
});
