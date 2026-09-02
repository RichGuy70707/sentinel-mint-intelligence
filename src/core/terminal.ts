export type TerminalPhase = "IDLE" | "SCANNING" | "LIVE" | "EMPTY" | "DEGRADED" | "ERROR";

export const DISCOVERY_CHAIN_COUNT = 4;
/** Client-side cap so a hung server function cannot leave the header on SCANNING. */
export const SCAN_CLIENT_BUDGET_MS = 22_000;

export interface TerminalPhaseInput {
  scanning: boolean;
  /** True only after a scan completed successfully in this browser session. */
  sessionFresh: boolean;
  scanFailed: boolean;
  liveCount: number;
  errorCount: number;
  chainCount?: number;
}

export function deriveTerminalPhase(input: TerminalPhaseInput): TerminalPhase {
  if (input.scanning) return "SCANNING";
  const chains = input.chainCount ?? DISCOVERY_CHAIN_COUNT;
  if (!input.sessionFresh) {
    if (input.scanFailed) return input.liveCount > 0 ? "DEGRADED" : "ERROR";
    return "IDLE";
  }
  if (input.scanFailed) return input.liveCount > 0 ? "DEGRADED" : "ERROR";
  if (input.errorCount > 0) {
    if (input.liveCount > 0) return "DEGRADED";
    if (input.errorCount >= chains) return "ERROR";
    return "DEGRADED";
  }
  if (input.liveCount > 0) return "LIVE";
  return "EMPTY";
}

export function terminalPhaseLabel(phase: TerminalPhase): string {
  return phase;
}

export function boardEmptyCopy(phase: TerminalPhase): string {
  switch (phase) {
    case "SCANNING":
      return "Reading mint Transfers…";
    case "LIVE":
      return "No mint activity in the current window.";
    case "EMPTY":
      return "No evidenced mint activity in current window.";
    case "DEGRADED":
      return "Coverage incomplete — one or more chains degraded. See Health.";
    case "ERROR":
      return "Scan failed. Open Health for provider diagnostics.";
    default:
      return "Waiting for first scan.";
  }
}

export function compactChainErrors(errors: { chainKey: string; message?: string }[]): string | null {
  if (!errors.length) return null;
  return errors.map((e) => `${e.chainKey.toUpperCase()} degraded`).join(" · ");
}

export type HintSnapshot = Record<
  string,
  { nftBalance?: number; nativeBalanceWei?: string; gateTokenBalance?: number }
>;

export function hintsEqual(a: HintSnapshot, b: HintSnapshot): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    const left = a[k];
    const right = b[k];
    if (!right) return false;
    if (left?.nftBalance !== right.nftBalance) return false;
    if (left?.nativeBalanceWei !== right.nativeBalanceWei) return false;
    if (left?.gateTokenBalance !== right.gateTokenBalance) return false;
  }
  return true;
}

/** Pure state step used by ProjectPane — never allocates when the value is unchanged. */
export function nextHintMap(prev: HintSnapshot, next: HintSnapshot, clear: boolean): HintSnapshot {
  if (clear) return Object.keys(prev).length === 0 ? prev : {};
  if (hintsEqual(prev, next)) return prev;
  return next;
}
