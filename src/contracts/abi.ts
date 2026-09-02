import { encodeFunctionData, decodeFunctionResult, type Abi } from "viem";

export const ERC165_ABI = [
  {
    type: "function",
    name: "supportsInterface",
    stateMutability: "view",
    inputs: [{ name: "interfaceId", type: "bytes4" }],
    outputs: [{ type: "bool" }],
  },
] as const satisfies Abi;

export const ERC721_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "maxSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const satisfies Abi;

export const COMMON_MINT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [{ name: "quantity", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "publicMint",
    stateMutability: "payable",
    inputs: [{ name: "quantity", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "mintPublic",
    stateMutability: "payable",
    inputs: [{ name: "quantity", type: "uint256" }],
    outputs: [],
  },
] as const satisfies Abi;

export const SEADROP_ABI = [
  {
    type: "function",
    name: "getPublicDrop",
    stateMutability: "view",
    inputs: [{ name: "nftContract", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "mintPrice", type: "uint80" },
          { name: "startTime", type: "uint48" },
          { name: "endTime", type: "uint48" },
          { name: "maxTotalMintableByWallet", type: "uint16" },
          { name: "feeBps", type: "uint16" },
          { name: "restrictFeeRecipients", type: "bool" },
        ],
      },
    ],
  },
] as const satisfies Abi;

export const IERC165 = {
  ERC165: "0x01ffc9a7",
  ERC721: "0x80ac58cd",
  ERC1155: "0xd9b67a26",
  ERC721Metadata: "0x5b5e139f",
} as const;

export function encodeCall(abi: Abi, name: string, args: readonly unknown[] = []): `0x${string}` {
  return encodeFunctionData({ abi, functionName: name, args: args as never });
}

export function decodeCall<T>(abi: Abi, name: string, data: `0x${string}`): T {
  return decodeFunctionResult({ abi, functionName: name, data }) as T;
}
