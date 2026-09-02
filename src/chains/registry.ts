import type { ChainDescriptor, ChainKey } from "@/core/types";

export const CHAINS: Record<ChainKey, ChainDescriptor> = {
  eth: {
    key: "eth",
    id: 1,
    name: "Ethereum",
    shortName: "ETH",
    nativeSymbol: "ETH",
    explorerTx: "https://etherscan.io/tx/",
    explorerAddress: "https://etherscan.io/address/",
    adapters: ["evm", "erc721", "erc1155", "seadrop"],
  },
  rh: {
    key: "rh",
    id: 4663,
    name: "Robinhood Chain",
    shortName: "RH",
    nativeSymbol: "ETH",
    explorerTx: "https://robinhoodchain.blockscout.com/tx/",
    explorerAddress: "https://robinhoodchain.blockscout.com/address/",
    adapters: ["evm", "erc721", "erc1155"],
  },
  ink: {
    key: "ink",
    id: 57073,
    name: "Ink",
    shortName: "INK",
    nativeSymbol: "ETH",
    explorerTx: "https://explorer.inkonchain.com/tx/",
    explorerAddress: "https://explorer.inkonchain.com/address/",
    adapters: ["evm", "erc721", "erc1155"],
  },
  base: {
    key: "base",
    id: 8453,
    name: "Base",
    shortName: "BASE",
    nativeSymbol: "ETH",
    explorerTx: "https://basescan.org/tx/",
    explorerAddress: "https://basescan.org/address/",
    adapters: ["evm", "erc721", "erc1155", "seadrop"],
  },
};

export const CHAIN_LIST = Object.values(CHAINS);

export function chainById(id: number): ChainDescriptor | undefined {
  return CHAIN_LIST.find((c) => c.id === id);
}

export function chainByKey(key: string): ChainDescriptor | undefined {
  return CHAINS[key as ChainKey];
}

export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const ZERO_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000000";
