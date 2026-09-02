import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProviderPool, type ProviderConfig } from "./pool.ts";

describe("provider pool", () => {
  it("fails over and opens the circuit", async () => {
    const configs: ProviderConfig[] = [
      { id: "dead", chainKey: "eth", url: "https://dead.example", priority: 1 },
      { id: "live", chainKey: "eth", url: "https://live.example", priority: 2 },
    ];
    const pool = new ProviderPool(configs);
    let hits = 0;
    const result = await pool.request("eth", "k1", async (url) => {
      if (url.includes("dead")) throw new Error("down");
      hits += 1;
      return 42;
    });
    assert.equal(result, 42);
    assert.equal(hits, 1);
    const snap = pool.snapshot();
    assert.equal(snap.find((s) => s.id === "dead")?.failures, 1);
  });

  it("dedupes in-flight requests", async () => {
    const pool = new ProviderPool([{ id: "live", chainKey: "eth", url: "https://live.example", priority: 1 }]);
    let calls = 0;
    const exec = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return calls;
    };
    const [a, b] = await Promise.all([pool.request("eth", "same", exec), pool.request("eth", "same", exec)]);
    assert.equal(a, b);
    assert.equal(calls, 1);
  });
});
