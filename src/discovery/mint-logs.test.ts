import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyTransferLog,
  ERC1155_TRANSFER_SINGLE,
  ERC721_TRANSFER,
} from "./mint-logs.ts";

const zero = `0x${"0".repeat(64)}`;
const to = `0x${"0".repeat(24)}1111111111111111111111111111111111111111`;
const tokenId = `0x${"0".repeat(63)}7`;

describe("mint log classification", () => {
  it("treats 3-topic Transfer as ERC-20, not an NFT mint", () => {
    const r = classifyTransferLog({ topics: [ERC721_TRANSFER, zero, to], data: "0x01" });
    assert.equal(r.kind, "erc20");
    assert.equal(r.quantity, 0);
  });

  it("counts ERC-721 Transfer with tokenId topic as one mint", () => {
    const r = classifyTransferLog({ topics: [ERC721_TRANSFER, zero, to, tokenId], data: "0x" });
    assert.equal(r.kind, "erc721");
    assert.equal(r.quantity, 1);
    assert.equal(r.recipient, "0x1111111111111111111111111111111111111111");
  });

  it("reads ERC-1155 TransferSingle quantity from data", () => {
    const value = `0x${"0".repeat(64)}${"a".padStart(64, "0")}`;
    const r = classifyTransferLog({
      topics: [ERC1155_TRANSFER_SINGLE, zero, zero, to],
      data: value,
    });
    assert.equal(r.kind, "erc1155");
    assert.equal(r.quantity, 10);
  });

  it("rejects implausible ERC-1155 quantities as non-mint evidence", () => {
    const value = `0x${"0".repeat(64)}${BigInt(1_000_000).toString(16).padStart(64, "0")}`;
    const r = classifyTransferLog({
      topics: [ERC1155_TRANSFER_SINGLE, zero, zero, to],
      data: value,
    });
    assert.equal(r.kind, "unknown");
    assert.equal(r.quantity, 0);
  });
});
