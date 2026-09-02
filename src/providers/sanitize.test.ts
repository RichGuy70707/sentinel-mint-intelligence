import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { payloadContainsSecret, sanitizeProviderText, sanitizeProviderUrl } from "./sanitize.ts";

const KEY = "alk_test_secret_key_ABCDEFG123456";

describe("provider secret sanitization", () => {
  it("strips Alchemy /v2/{key} from snapshot URLs", () => {
    const raw = `https://eth-mainnet.g.alchemy.com/v2/${KEY}`;
    const clean = sanitizeProviderUrl(raw);
    assert.equal(clean.includes(KEY), false);
    assert.match(clean, /alchemy.com/);
    assert.match(clean, /\*\*\*/);
    const snap = [{ id: "alchemy-eth", url: clean }];
    assert.equal(payloadContainsSecret(snap, [KEY]), false);
  });

  it("sanitizes thrown-style error text", () => {
    const raw = `RPC failed https://eth-mainnet.g.alchemy.com/v2/${KEY} timeout`;
    const clean = sanitizeProviderText(raw);
    assert.ok(clean);
    assert.equal(clean.includes(KEY), false);
  });

  it("does not leave the key in serialized state", () => {
    const snap = {
      url: sanitizeProviderUrl(`https://base-mainnet.g.alchemy.com/v2/${KEY}`),
      lastError: sanitizeProviderText(`alchemy_key=${KEY}`),
    };
    assert.equal(JSON.stringify(snap).includes(KEY), false);
  });
});
