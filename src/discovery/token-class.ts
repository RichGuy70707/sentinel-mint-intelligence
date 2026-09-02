/** A from-zero Transfer is not an NFT mint unless the token standard is evidenced. */

const FUNGIBLE_TYPES = /ERC-?20|FUNGIBLE/i;
const NFT_TYPES = /ERC-?721|ERC-?1155|NFT/i;

export function isFungibleToken(input: {
  contractType?: string | null;
  interfaces?: string[] | null;
  tokenType?: string | null;
}): boolean {
  const type = `${input.contractType ?? ""} ${input.tokenType ?? ""}`;
  if (FUNGIBLE_TYPES.test(type) && !NFT_TYPES.test(type)) return true;
  const interfaces = input.interfaces ?? [];
  if (interfaces.includes("ERC20") && !interfaces.includes("ERC721") && !interfaces.includes("ERC1155")) return true;
  return false;
}

export function isNftToken(input: {
  contractType?: string | null;
  interfaces?: string[] | null;
  tokenType?: string | null;
}): boolean {
  const type = `${input.contractType ?? ""} ${input.tokenType ?? ""}`;
  if (NFT_TYPES.test(type)) return true;
  const interfaces = input.interfaces ?? [];
  return interfaces.includes("ERC721") || interfaces.includes("ERC1155") || interfaces.includes("ERC721Metadata");
}

export function keepMintCandidate(input: {
  contractType?: string | null;
  interfaces?: string[] | null;
  tokenType?: string | null;
  bytecodePresent?: boolean | null;
  nftEventEvidence?: boolean;
}): boolean {
  if (isFungibleToken(input)) return false;
  if (isNftToken(input)) return true;
  if (input.nftEventEvidence) return true;
  return false;
}
