const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const ERC721_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const ERC1155_TRANSFER_SINGLE =
  "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";
export const ERC1155_TRANSFER_BATCH =
  "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb";

export type MintLogKind = "erc721" | "erc1155" | "erc20" | "unknown";

export interface ClassifiedMintLog {
  kind: MintLogKind;
  quantity: number;
  recipient: string | null;
}

function normTopic(topic: string | undefined): string {
  return (topic ?? "").toLowerCase();
}

export function topicToAddress(topic: string | undefined): string | null {
  const t = normTopic(topic);
  if (t.length < 66) return null;
  const addr = `0x${t.slice(-40)}`;
  if (addr === ZERO_ADDRESS) return null;
  return addr;
}

export function classifyTransferLog(log: { topics: string[]; data?: string }): ClassifiedMintLog {
  const sig = normTopic(log.topics[0]);
  if (sig === ERC1155_TRANSFER_SINGLE) {
    return {
      kind: "erc1155",
      quantity: decodeUintPair(log.data).value,
      recipient: topicToAddress(log.topics[3]),
    };
  }
  if (sig === ERC1155_TRANSFER_BATCH) {
    return {
      kind: "erc1155",
      quantity: decodeBatchQuantity(log.data),
      recipient: topicToAddress(log.topics[3]),
    };
  }
  if (sig === ERC721_TRANSFER) {
    if (log.topics.length >= 4) {
      return { kind: "erc721", quantity: 1, recipient: topicToAddress(log.topics[2]) };
    }
    return { kind: "erc20", quantity: 0, recipient: topicToAddress(log.topics[2]) };
  }
  return { kind: "unknown", quantity: 0, recipient: null };
}

export function isNftMintLog(log: { topics: string[]; data?: string }): boolean {
  const kind = classifyTransferLog(log).kind;
  return kind === "erc721" || kind === "erc1155";
}

function decodeUintPair(data: string | undefined): { id: number; value: number } {
  const hex = (data ?? "0x").replace(/^0x/, "").padStart(128, "0");
  const value = Number(BigInt(`0x${hex.slice(64, 128)}`));
  const id = Number(BigInt(`0x${hex.slice(0, 64)}`));
  return { id, value: Number.isFinite(value) && value > 0 ? value : 1 };
}

function decodeBatchQuantity(data: string | undefined): number {
  const hex = (data ?? "0x").replace(/^0x/, "");
  if (hex.length < 192) return 1;
  try {
    const offset = Number(BigInt(`0x${hex.slice(64, 128)}`)) * 2;
    const len = Number(BigInt(`0x${hex.slice(offset, offset + 64)}`));
    if (!Number.isFinite(len) || len <= 0 || len > 256) return 1;
    let total = 0;
    for (let i = 0; i < len; i++) {
      const start = offset + 64 + i * 64;
      total += Number(BigInt(`0x${hex.slice(start, start + 64)}`));
    }
    return total > 0 && Number.isFinite(total) ? total : 1;
  } catch {
    return 1;
  }
}
