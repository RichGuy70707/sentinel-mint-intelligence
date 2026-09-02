import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFungibleToken, isNftToken, keepMintCandidate } from "./token-class.ts";

describe("token standard classification", () => {
  it("does not treat ERC-20 zero-address Transfers as NFT mints", () => {
    assert.equal(isFungibleToken({ contractType: "ERC-20" }), true);
    assert.equal(keepMintCandidate({ contractType: "ERC-20", interfaces: ["ERC20"] }), false);
    assert.equal(keepMintCandidate({ tokenType: "ERC-20" }), false);
  });

  it("keeps evidenced ERC-721 and ERC-1155 mints", () => {
    assert.equal(isNftToken({ interfaces: ["ERC721"] }), true);
    assert.equal(keepMintCandidate({ interfaces: ["ERC721"] }), true);
    assert.equal(keepMintCandidate({ contractType: "ERC-1155", interfaces: ["ERC1155"] }), true);
  });

  it("does not classify by token name", () => {
    assert.equal(isFungibleToken({ contractType: "UNKNOWN_CONTRACT", interfaces: [] }), false);
    assert.equal(keepMintCandidate({ contractType: "UNKNOWN_CONTRACT", interfaces: [] }), true);
  });
});
