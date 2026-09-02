import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openSeaLookupKind } from "./opensea.ts";

describe("OpenSea lookup classification", () => {
  it("does not treat collection-not-found as an API failure", () => {
    assert.equal(openSeaLookupKind(404), "not_found");
    assert.equal(openSeaLookupKind(401), "retry");
    assert.equal(openSeaLookupKind(403), "retry");
    assert.equal(openSeaLookupKind(429), "retry");
    assert.equal(openSeaLookupKind(200), "other");
  });
});
