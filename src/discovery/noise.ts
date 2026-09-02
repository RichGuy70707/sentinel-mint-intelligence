/** Protocol receipt / infrastructure NFTs that mint from zero but are not drop opportunities. */

const NAME_NOISE = [
  /uniswap\s*v[34]/i,
  /positions?\s+nft/i,
  /slipstream\s+position/i,
  /namewrapper/i,
  /withdrawal\s+request/i,
  /\blp\s*nft\b/i,
  /nonfungibleposition/i,
  /permit2/i,
];

const SYMBOL_NOISE = [/UNI-V[34]/i, /UNI-POS/i, /^NFP$/i];

const KNOWN_RECEIPTS: Record<string, string> = {
  "0xc36442b4a4522e871399cd717abdd847ab11fe88": "Uniswap V3 Positions",
  "0xd4416b13d2b3a9abae7acd5d6ed51c9275753054": "ENS NameWrapper",
  "0xbd216513d74c8cf14cf4902e56b69bdd558bc6e6": "Uniswap V4 Positions",
  "0x03a520b32c04bf3beef7beb72e919cf822ed34f1": "Uniswap V3 Positions (Base)",
  "0x827922686190790b37229fd06084350e74485b72": "Slipstream Positions",
};

export function isProtocolReceiptNft(input: { name?: string | null; symbol?: string | null; contract?: string | null }): boolean {
  const contract = input.contract?.toLowerCase() ?? "";
  if (contract && KNOWN_RECEIPTS[contract]) return true;
  const name = input.name ?? "";
  const symbol = input.symbol ?? "";
  if (NAME_NOISE.some((re) => re.test(name))) return true;
  if (SYMBOL_NOISE.some((re) => re.test(symbol))) return true;
  return false;
}

export function receiptLabel(input: { name?: string | null; contract?: string | null }): string | null {
  const contract = input.contract?.toLowerCase() ?? "";
  if (contract && KNOWN_RECEIPTS[contract]) return KNOWN_RECEIPTS[contract];
  if (isProtocolReceiptNft(input)) return "Protocol receipt NFT";
  return null;
}
