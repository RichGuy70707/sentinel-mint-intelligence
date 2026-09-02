import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bytecodeHasSelector, detectPublicMintFn, selectorFor } from "./selectors.ts";

describe("mint selector evidence", () => {
  it("finds mint(uint256) only when PUSH4 selector is in bytecode", () => {
    const sel = selectorFor("mint(uint256)");
    const present = `0x60806040${"63" + sel.slice(2)}00`;
    const absent = "0x608060405260043610";
    assert.equal(detectPublicMintFn(present), "mint");
    assert.equal(detectPublicMintFn(absent), null);
    assert.equal(bytecodeHasSelector(present, sel), true);
  });

  it("does not invent a selector from empty or missing code", () => {
    assert.equal(detectPublicMintFn("0x"), null);
    assert.equal(detectPublicMintFn(""), null);
  });
});
