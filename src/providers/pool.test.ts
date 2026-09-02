import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RpcError } from "./classify.ts";
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
      if (url.includes("dead")) throw new Error("RPC HTTP 500 for eth_blockNumber");
      hits += 1;
      return 42;
    });
    assert.equal(result, 42);
    assert.equal(hits, 1);
    const snap = pool.snapshot();
    assert.equal(snap.find((s) => s.id === "dead")?.failures, 1);
    assert.equal(snap.find((s) => s.id === "live")?.state, "HEALTHY");
  });

  it("does not mark a provider unhealthy on application eth_call revert", async () => {
    const pool = new ProviderPool([{ id: "eth-rpc", chainKey: "eth", url: "https://live.example", priority: 1 }]);
    await assert.rejects(
      () =>
        pool.request("eth", "call", async () => {
          throw new RpcError("execution reverted", "APPLICATION");
        }),
      /execution reverted/,
    );
    const snap = pool.snapshot()[0];
    assert.equal(snap?.state, "HEALTHY");
    assert.equal(snap?.failures, 0);
  });

  it("does not fail over on application revert", async () => {
    const pool = new ProviderPool([
      { id: "a", chainKey: "eth", url: "https://a.example", priority: 0 },
      { id: "b", chainKey: "eth", url: "https://b.example", priority: 1 },
    ]);
    const used: string[] = [];
    await assert.rejects(() =>
      pool.request("eth", "call2", async (url) => {
        used.push(url);
        throw new RpcError("execution reverted", "APPLICATION");
      }),
    );
    assert.equal(used.length, 1);
  });

  it("classifies HTTP 403 as ACCESS_DENIED and skips the slot", async () => {
    const pool = new ProviderPool([
      { id: "denied", chainKey: "base", url: "https://denied.example", priority: 0 },
      { id: "ok", chainKey: "base", url: "https://ok.example", priority: 1 },
    ]);
    const result = await pool.request("base", "bn", async (url) => {
      if (url.includes("denied")) throw new Error("RPC HTTP 403 for eth_chainId");
      return "0x1";
    });
    assert.equal(result, "0x1");
    assert.equal(pool.snapshot().find((s) => s.id === "denied")?.state, "ACCESS_DENIED");
    const second = await pool.request("base", "bn2", async (url) => {
      if (url.includes("denied")) throw new Error("should not hammer");
      return "0x2";
    });
    assert.equal(second, "0x2");
  });

  it("classifies 429 as RATE_LIMITED", async () => {
    const pool = new ProviderPool([
      { id: "rl", chainKey: "eth", url: "https://rl.example", priority: 0 },
      { id: "ok", chainKey: "eth", url: "https://ok.example", priority: 1 },
    ]);
    await pool.request("eth", "rl", async (url) => {
      if (url.includes("rl.")) throw new Error("RPC HTTP 429 for eth_blockNumber");
      return 1;
    });
    assert.equal(pool.snapshot().find((s) => s.id === "rl")?.state, "RATE_LIMITED");
  });

  it("classifies timeout and network failures", async () => {
    const pool = new ProviderPool([
      { id: "to", chainKey: "eth", url: "https://to.example", priority: 0 },
      { id: "net", chainKey: "eth", url: "https://net.example", priority: 1 },
      { id: "ok", chainKey: "eth", url: "https://ok.example", priority: 2 },
    ]);
    await pool.request("eth", "t1", async (url) => {
      if (url.includes("to.")) throw new Error("Provider timeout after 8000ms");
      if (url.includes("net.")) throw new Error("fetch failed");
      return 1;
    });
    const snap = pool.snapshot();
    assert.ok(["TIMEOUT", "UNHEALTHY"].includes(snap.find((s) => s.id === "to")?.state ?? ""));
    assert.ok(["NETWORK_ERROR", "UNHEALTHY"].includes(snap.find((s) => s.id === "net")?.state ?? ""));
    assert.equal(snap.find((s) => s.id === "ok")?.state, "HEALTHY");
  });

  it("prefers a healthy slot and keeps public fallback usable", async () => {
    const pool = new ProviderPool([
      { id: "alchemy-eth-1", chainKey: "eth", url: "https://denied.example", priority: 0 },
      { id: "eth-publicnode", chainKey: "eth", url: "https://public.example", priority: 1 },
    ]);
    await pool.request("eth", "x", async (url) => {
      if (url.includes("denied")) throw new Error("RPC HTTP 403 for eth_chainId");
      return 7;
    });
    const n = await pool.request("eth", "y", async (url) => {
      assert.ok(url.includes("public"));
      return 8;
    });
    assert.equal(n, 8);
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
