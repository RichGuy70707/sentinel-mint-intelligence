import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { payloadContainsSecret } from "./sanitize.ts";
import {
  alchemyRpcEndpoints,
  listedAlchemyKeys,
  listedOpenSeaKeys,
  providerAvailability,
} from "./secrets.ts";

const SLOT_A = "testslot_alchemy_aaaaaaaaaaaaaaaa";
const SLOT_B = "testslot_alchemy_bbbbbbbbbbbbbbbb";
const SLOT_C = "testslot_alchemy_cccccccccccccccc";
const SEA_A = "testslot_opensea_aaaaaaaaaaaaaaaa";
const SEA_B = "testslot_opensea_bbbbbbbbbbbbbbbb";
const SEA_C = "testslot_opensea_cccccccccccccccc";

function reader(map: Record<string, string | undefined>) {
  return (name: string) => map[name];
}

describe("provider key slots", () => {
  it("consumes all three Alchemy and OpenSea env names", () => {
    const read = reader({
      ALCHEMY_API_KEY: SLOT_A,
      ALCHEMY_API_KEY_2: SLOT_B,
      ALCHEMY_API_KEY_3: SLOT_C,
      OPENSEA_API_KEY: SEA_A,
      OPENSEA_API_KEY_2: SEA_B,
      OPENSEA_API_KEY_3: SEA_C,
    });
    assert.equal(listedAlchemyKeys(read).length, 3);
    assert.equal(listedOpenSeaKeys(read).length, 3);
    const avail = providerAvailability(read);
    assert.equal(avail.alchemySlotCount, 3);
    assert.equal(avail.openseaSlotCount, 3);
    assert.equal(avail.alchemy.rh, false);
  });

  it("uses however many slots are present", () => {
    const read = reader({ ALCHEMY_API_KEY: SLOT_A, OPENSEA_API_KEY: SEA_A });
    assert.equal(listedAlchemyKeys(read).length, 1);
    assert.equal(listedOpenSeaKeys(read).length, 1);
  });

  it("dedupes identical slot values", () => {
    const read = reader({
      ALCHEMY_API_KEY: SLOT_A,
      ALCHEMY_API_KEY_2: SLOT_A,
      ALCHEMY_API_KEY_3: SLOT_B,
    });
    assert.equal(listedAlchemyKeys(read).length, 2);
  });

  it("builds one RPC endpoint per slot for supported chains only", () => {
    const read = reader({ ALCHEMY_API_KEY: SLOT_A, ALCHEMY_API_KEY_2: SLOT_B });
    assert.equal(alchemyRpcEndpoints("eth", read).length, 2);
    assert.equal(alchemyRpcEndpoints("base", read).length, 2);
    assert.equal(alchemyRpcEndpoints("ink", read).length, 2);
    assert.equal(alchemyRpcEndpoints("rh", read).length, 0);
  });

  it("never puts slot values into snapshot-shaped payloads", () => {
    const read = reader({ ALCHEMY_API_KEY: SLOT_A, ALCHEMY_API_KEY_2: SLOT_B });
    const eps = alchemyRpcEndpoints("eth", read).map((e) => ({ id: e.id, url: e.url.replace(SLOT_A, "***").replace(SLOT_B, "***") }));
    assert.equal(payloadContainsSecret(eps, [SLOT_A, SLOT_B]), false);
    const avail = providerAvailability(read);
    assert.equal(payloadContainsSecret(avail, [SLOT_A, SLOT_B]), false);
  });
});
