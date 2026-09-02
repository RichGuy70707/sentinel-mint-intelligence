export function reconcileSupply(
  minted: number | null,
  supply: number | null,
): { minted: number | null; supply: number | null } {
  if (minted == null || supply == null) return { minted, supply };
  if (supply <= 0) return { minted, supply: null };
  if (minted > supply) return { minted, supply: null };
  return { minted, supply };
}

const PLACEHOLDER =
  /unidentified\s+(contract|token|collection)|unknown\s+(contract|token|collection|project)|unnamed\s+(contract|token|collection)|not\s+identified|^contract\s+0x|^token\s+0x/i;

export function isPlaceholderName(name: string | null | undefined): boolean {
  const trimmed = name?.trim();
  if (!trimmed) return true;
  if (trimmed === "UNKNOWN PROJECT") return true;
  if (trimmed.startsWith("0x") || trimmed.includes("…")) return true;
  if (trimmed.length < 2) return true;
  if (PLACEHOLDER.test(trimmed)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(trimmed)) return true;
  return false;
}

export function preferName(...names: Array<string | null | undefined>): string {
  for (const name of names) {
    if (isPlaceholderName(name)) continue;
    return name!.trim();
  }
  return "UNKNOWN PROJECT";
}
