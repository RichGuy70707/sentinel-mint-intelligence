import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyFailure, classifyHttpStatus, isTransportFailure, RpcError } from "./classify.ts";

describe("provider failure classification", () => {
  it("treats eth_chainId / blockNumber HTTP 200 paths as transport, not application", () => {
    assert.equal(classifyHttpStatus(200), "UNKNOWN");
    assert.equal(isTransportFailure("APPLICATION"), false);
  });

  it("classifies HTTP 403 as ACCESS_DENIED and 401 as AUTH_FAILED", () => {
    assert.equal(classifyHttpStatus(403), "ACCESS_DENIED");
    assert.equal(classifyHttpStatus(401), "AUTH_FAILED");
    assert.equal(classifyFailure(new Error("RPC HTTP 403 for eth_chainId")), "ACCESS_DENIED");
  });

  it("classifies 429 as RATE_LIMITED, timeout, and network separately", () => {
    assert.equal(classifyHttpStatus(429), "RATE_LIMITED");
    assert.equal(classifyFailure(new Error("Provider timeout after 8000ms")), "TIMEOUT");
    assert.equal(classifyFailure(new Error("fetch failed")), "NETWORK_ERROR");
    assert.equal(classifyHttpStatus(500), "NETWORK_ERROR");
  });

  it("does not treat application eth_call revert as transport failure", () => {
    const err = new RpcError("execution reverted", "APPLICATION");
    assert.equal(classifyFailure(err), "APPLICATION");
    assert.equal(isTransportFailure("APPLICATION"), false);
    assert.equal(classifyFailure(new Error("execution reverted")), "APPLICATION");
  });
});
