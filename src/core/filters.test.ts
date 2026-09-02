import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyFilters, DEFAULT_FILTERS, fuzzyScore, matchesQuery } from "./filters.ts";
import type { ProjectModel } from "./types.ts";

function project(over: Partial<ProjectModel> = {}): ProjectModel {
  return {
    id: "eth:0xabc",
    chainKey: "eth",
    chainId: 1,
    name: "Atlas",
    symbol: "ATL",
    contract: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    collectionSlug: "atlas",
    description: "",
    imageUrl: null,
    links: [],
    stages: [
      {
        id: "s1",
        kind: "PUBLIC",
        label: "Public",
        mechanism: "PUBLIC",
        mechanismConfidence: "DERIVED",
        startTime: Date.now() - 1000,
        endTime: Date.now() + 60_000,
        priceWei: "0",
        maxPerWallet: 2,
        maxSupply: 1000,
        requiresVerification: false,
        provenance: { source: "DERIVED", quality: "ESTIMATED", confidence: "LOW", fetchedAt: Date.now(), ttlMs: 1000 },
      },
    ],
    supply: 1000,
    remaining: 10,
    minted: 20,
    priceWei: "0",
    status: "LIVE",
    detectedAt: Date.now(),
    lastActivityAt: Date.now(),
    mintVelocityPerMin: 3,
    uniqueMinters: 4,
    verifiedSource: false,
    bytecodePresent: true,
    contractType: "ERC-721",
    interfaces: ["ERC721"],
    riskFlags: [],
    market: null,
    deployer: null,
    saleSource: null,
    provenance: { source: "ON_CHAIN", quality: "LIVE", confidence: "HIGH", fetchedAt: Date.now(), ttlMs: 1000 },
    ...over,
  };
}

describe("filters", () => {
  it("fuzzy matches names and contracts", () => {
    assert.ok(fuzzyScore("atlas prime", "atl") > 0.5);
    assert.equal(matchesQuery(project(), "0xaaaa"), true);
    assert.equal(matchesQuery(project(), "nope-xyz"), false);
  });

  it("applies chain price and free mint flags", () => {
    const list = [project(), project({ id: "rh:1", chainKey: "rh", chainId: 4663, priceWei: "1000", stages: [] })];
    const free = applyFilters(list, { ...DEFAULT_FILTERS, freeMint: true });
    assert.equal(free.length, 1);
    const rh = applyFilters(list, { ...DEFAULT_FILTERS, chain: "rh" });
    assert.equal(rh[0]?.chainKey, "rh");
  });
});
