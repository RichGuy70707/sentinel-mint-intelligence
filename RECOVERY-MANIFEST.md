# Recovery manifest

## M0–M12 combined foundation (2026-09-02)

- Product: SENTINEL
- Auth: OFF (wallet registry is local)
- Database: OFF
- Chains: ETH 1, RH 4663, INK 57073, BASE 8453
- Execution: user-authorized only
- Known limitations:
  - Wide `eth_getLogs` windows can be rejected by public RPCs
  - MintGo adapter isolated (session required)
  - Market floor/volume UNKNOWN without a keyed market API
  - Custom mint ABIs beyond mint/publicMint/mintPublic are not auto-decoded

## M1–M3 additive (2026-09-02)

- Protocol-receipt noise filter (Uniswap positions, NameWrapper, Slipstream)
- Blockscout multi-host fallback
- Inspect / sale / OpenSea TTL cache
- Extra supply views + shared Alchemy key fallback
- Wallet `balanceOf` / native-balance hints wired into eligibility
- Sale window views (`saleStart` / `publicSaleStart` / …) only when non-zero
- Non-zero `merkleRoot` marks REQUIRES_PROOF — never invented as ELIGIBLE
- Discovery no longer fabricates `scannedAt - 60s` as a mint start
- LIVE status may come from evidenced mint Transfers when the sale window is unread
