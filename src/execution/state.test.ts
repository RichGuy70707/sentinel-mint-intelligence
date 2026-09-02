import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAuthorizeEvent, canAuthorize, isUserRejection } from "./state.ts";

describe("execution authorization state", () => {
  it("does not stamp AUTHORIZED when no injected wallet exists", () => {
    const next = applyAuthorizeEvent("READY", { type: "NO_INJECTED_WALLET" });
    assert.equal(next, "NOT_AUTHORIZED");
    assert.notEqual(next, "AUTHORIZED");
  });

  it("marks user rejection separately from failure", () => {
    assert.equal(applyAuthorizeEvent("AWAITING_WALLET", { type: "USER_REJECTED" }), "REJECTED");
    assert.equal(isUserRejection({ code: 4001, message: "User rejected the request" }), true);
  });

  it("marks sign failure and successful submit", () => {
    assert.equal(applyAuthorizeEvent("READY", { type: "SIGN_FAILED" }), "SIGN_FAILED");
    assert.equal(applyAuthorizeEvent("READY", { type: "SIGNED_AND_BROADCAST", txHash: "0xabc" }), "SUBMITTED");
    assert.equal(applyAuthorizeEvent("SUBMITTED", { type: "RECEIPT_PENDING" }), "PENDING");
    assert.equal(applyAuthorizeEvent("PENDING", { type: "RECEIPT_CONFIRMED" }), "CONFIRMED");
    assert.equal(applyAuthorizeEvent("PENDING", { type: "RECEIPT_REVERTED" }), "REVERTED");
  });

  it("only allows authorize from prepared/simulated/ready", () => {
    assert.equal(canAuthorize("READY"), true);
    assert.equal(canAuthorize("NOT_AUTHORIZED"), false);
    assert.equal(canAuthorize("SUBMITTED"), false);
  });
});
