# SENTINEL

NFT mint intelligence terminal: discovery, stage intelligence, multi-wallet eligibility, transaction simulation, and user-authorized execution.

## What it does

- Scans public EVM RPCs on Ethereum, Robinhood Chain (4663), Ink (57073), and Base for mint `Transfer` logs from the zero address
- Inspects contracts on demand (`eth_getCode`, ERC-165, name/symbol/supply)
- Scores every registered wallet against the active or next stage with explicit evidence
- Builds canonical mint calldata and simulates with `eth_call` / `eth_estimateGas`
- Broadcasts only after you authorize in an injected wallet — keys never touch the app

## What it will not pretend

- MintGo's public HTTP API requires a browser session. The adapter is isolated; if it is closed, SENTINEL keeps running on-chain.
- Floor/volume stay `UNKNOWN` until a market provider is configured.
- Allowlist / Merkle / server-signed mints return `REQUIRES_PROOF` or `REQUIRES_VERIFICATION`. They are never marked eligible from a heuristic.

## Local model

Wallets, alerts, watchlist, and the execution queue persist in the browser. There is no account system and no private-key storage.
