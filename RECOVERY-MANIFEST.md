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

## Live terminal stabilization (2026-09-02)

- Header phase is derived: IDLE / SCANNING / LIVE / EMPTY / DEGRADED / ERROR
- LIVE requires a session-fresh completed scan with evidenced live projects
- Persisted catalog cannot drive LIVE (sessionFresh is not persisted)
- Failed/timed-out scans keep cached rows and never stamp LIVE
- ProjectPane hint effect is referentially stable (no setState-on-empty loop)
- Per-chain discovery budget 12s; client scan budget 22s
- Watchlist cache is not merged into scan results (prevents stale LIVE)

## Execution + eligibility integrity (2026-09-02)

- Provider snapshots redact `/v2/{key}` before crossing the client boundary
- Prepare refuses unread price (never encodes value 0) and refuses assumed `mint()`
- SeaDrop public mint is the only auto-encoded path when `getPublicDrop` is evidenced
- Authorize without an injected wallet is NOT_AUTHORIZED, never AUTHORIZED
- Simulation distinguishes revert vs provider error
- NFT-gated without a gate contract is REQUIRES_VERIFICATION
- Eligibility hints prefetch for top scanned projects

## Provider key pool (2026-09-02)

- Consumes OPENSEA_API_KEY{,_2,_3} and ALCHEMY_API_KEY{,_2,_3} from server env only
- Alchemy slots register separately on eth/base/ink; public RPC remains fallback
- OpenSea uses a credential pool with failover on 401/403/429/5xx
- Snapshots redact key pathnames; slots start RECOVERING until a request succeeds
- RH Alchemy still requires ALCHEMY_RH_API_KEY (not invented from the shared keys)

## Production readiness pass (2026-09-02)

- Public mint encode only when SeaDrop is evidenced or a mint/publicMint/mintPublic selector is in bytecode
- Unread price still refuses value 0
- Submitted txs poll receipts: PENDING / CONFIRMED / REVERTED; provider errors stay pending
- Baseline checkpoint 5f8af44 before this pass

## Audit P1 follow-through (2026-09-02)

- Catalog persist rehydrate clears sessionFresh; first scan waits for hydration
- Successful scans keep first-seen detectedAt
- Protocol receipts / non-721/1155 dropped after enrich
- Receipt tracker mounted in the shell; queue stores chainKey
- Eligibility hint maps used on Opportunities, project detail, wallet detail, Projects filters

## Provider health semantics (2026-09-02)

- Health probes use eth_chainId + eth_blockNumber, not contract eth_call
- Application "execution reverted" does not fail a provider or trigger failover
- HTTP 403/401/429 become ACCESS_DENIED / AUTH_FAILED / RATE_LIMITED and skip the slot
- Public RPC remains fallback; header DEGRADED only when a chain has no projects and an error

## Discovery data integrity (2026-09-02)

- LIVE-from-activity uses window mint Transfers, not lifetime totalSupply
- Future sale windows stay UPCOMING even if the collection already has supply
- Evidenced sold-out (minted >= maxSupply) is ENDED
- Duplicate mint logs are collapsed; Blockscout velocity is omitted without a time window
- Unreadable price displays as —

## Multi-wallet eligibility (2026-09-02)

- Paid public stays UNKNOWN until native balance is read; insufficient funds is NOT_ELIGIBLE
- NFT gates use gateTokenBalance, not mint-collection balanceOf
- ERC-20 / decimals-without-NFT-interface tokens are not mint opportunities
- Opportunities list wallet + reason + evidenced price

## Discovery hardening (2026-09-02)

- 3-topic Transfer is ERC-20 and is excluded from the mint rail
- ERC-721 requires the tokenId topic; ERC-1155 counts TransferSingle quantity
- Unclassified contracts stay off the primary board
- Missing names render as UNKNOWN PROJECT
- OpenSea 404 is collection-not-found, not an API outage
- ERC-1155 quantities above 10,000 in one log are treated as untrusted
