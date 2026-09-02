export function reconcileSupply(
  minted: number | null,
  supply: number | null,
): { minted: number | null; supply: number | null } {
  if (minted == null || supply == null) return { minted, supply };
  if (supply <= 0) return { minted, supply: null };
  if (minted > supply) return { minted, supply: null };
  return { minted, supply };
}

export function preferName(...names: Array<string | null | undefined>): string {
  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed) continue;
    if (trimmed === "UNKNOWN PROJECT") continue;
    if (trimmed.startsWith("0x") || trimmed.includes("…")) continue;
    if (trimmed.length < 2) continue;
    return trimmed;
  }
  return "UNKNOWN PROJECT";
}
