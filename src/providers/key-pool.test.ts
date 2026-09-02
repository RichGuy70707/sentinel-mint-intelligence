import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KeyPool } from "./key-pool.ts";
import { ProviderPool } from "./pool.ts";
import { payloadContainsSecret } from "./sanitize.ts";

const A = "testslot_keypool_aaaaaaaaaaaaaaaa";
const B = "testslot_keypool_bbbbbbbbbbbbbbbb";

describe("credential key pool", () => {
  it("starts RECOVERING until a request succeeds", () => {
    const pool = new KeyPool([
      { id: "opensea-1", secret: A },
      { id: "opensea-2", secret: B },
    ]);
    const snap = pool.snapshot();
    assert.equal(snap[0]?.state, "RECOVERING");
    assert.equal(payloadContainsSecret(snap, [A, B]), false);
  });

  it("fails over to the next slot after an error", async () => {
    const pool = new KeyPool([
      { id: "opensea-1", secret: A },
      { id: "opensea-2", secret: B },
    ]);
    const used: string[] = [];
    const result = await pool.request(async (secret) => {
      used.push(secret);
      if (secret === A) throw new Error("rate limited");
      return "ok";
    });
    assert.equal(result, "ok");
    assert.deepEqual(used, [A, B]);
    const snap = pool.snapshot();
    assert.equal(snap.find((s) => s.id === "opensea-2")?.state, "HEALTHY");
    assert.equal(payloadContainsSecret(snap, [A, B]), false);
  });

  it("RPC pool failsover across Alchemy-shaped URLs without leaking keys", async () => {
    const pool = new ProviderPool([
      { id: "alchemy-eth-1", chainKey: "eth", url: `https://eth-mainnet.g.alchemy.com/v2/${A}`, priority: 0 },
      { id: "alchemy-eth-2", chainKey: "eth", url: `https://eth-mainnet.g.alchemy.com/v2/${B}`, priority: 0 },
    ]);
    let hits = 0;
    const value = await pool.request("eth", "k", async (url) => {
      hits += 1;
      if (url.includes(A)) throw new Error(`down ${url}`);
      return 7;
    });
    assert.equal(value, 7);
    assert.equal(hits, 2);
    const snap = pool.snapshot();
    assert.equal(payloadContainsSecret(snap, [A, B]), false);
    assert.ok(snap.every((s) => !s.url.includes(A) && !s.url.includes(B)));
  });
});
