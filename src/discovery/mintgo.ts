/**
 * Optional MintGo adapter.
 * MintGo's HTTP surface requires a browser session and is NOT a hard dependency.
 * When the public session-gated API is unavailable we return an isolated miss
 * and the rest of the terminal continues on on-chain providers.
 */
export interface MintGoFetchResult {
  available: boolean;
  reason: string;
  status: number | null;
}

export async function fetchMintGoPublic(): Promise<MintGoFetchResult> {
  try {
    const res = await fetch("https://mintgo.fun/api/mints", {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(2_500),
    });
    const status = res.status;
    if (res.status === 401 || res.status === 403) {
      return {
        available: false,
        reason: "MintGo requires a browser session. Adapter isolated; on-chain discovery continues.",
        status,
      };
    }
    if (!res.ok) {
      return { available: false, reason: `MintGo HTTP ${res.status}`, status };
    }
    return { available: true, reason: "MintGo public payload accepted", status };
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : "MintGo unreachable",
      status: null,
    };
  }
}

export function normalizeMintGo(_raw: unknown): never[] {
  // Deliberately empty until a documented, session-free public schema exists.
  // Never leak MintGo response shapes into the domain model.
  return [];
}
