# Recovery manifest

Product: SENTINEL
Auth: OFF
Database: OFF
Chains: ETH 1, RH 4663, INK 57073, BASE 8453
Execution: user-authorized only

Known limitations:
- Wide eth_getLogs windows can be rejected by public RPCs
- MintGo adapter isolated (session required)
- Market floor/volume UNKNOWN without a keyed market API
- Custom mint ABIs beyond mint/publicMint/mintPublic are not auto-decoded
