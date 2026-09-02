import type { ChainKey } from "@/core/types";
import { normalizeAddress } from "@/core/address";
import { decodeCall, encodeCall, ERC721_ABI } from "@/contracts/abi";
import { ethCall, ethGetBalance } from "@/providers/rpc";

export interface WalletHintRow {
  address: string;
  nftBalance: number | null;
  nativeBalanceWei: string | null;
}

export async function readWalletHints(
  chainKey: ChainKey,
  contract: string,
  wallets: string[],
): Promise<WalletHintRow[]> {
  const unique = [...new Set(wallets.map((w) => normalizeAddress(w)))];
  return Promise.all(
    unique.map(async (address) => {
      const [nftBalance, nativeBalanceWei] = await Promise.all([
        readNftBalance(chainKey, contract, address),
        ethGetBalance(chainKey, address)
          .then((v) => v.toString())
          .catch(() => null),
      ]);
      return { address, nftBalance, nativeBalanceWei };
    }),
  );
}

async function readNftBalance(chainKey: ChainKey, contract: string, owner: string): Promise<number | null> {
  try {
    const data = encodeCall(ERC721_ABI, "balanceOf", [owner]);
    const raw = (await ethCall(chainKey, contract, data)) as `0x${string}`;
    const value = decodeCall<bigint>(ERC721_ABI, "balanceOf", raw);
    return Number(value);
  } catch {
    return null;
  }
}
