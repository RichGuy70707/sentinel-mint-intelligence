import { classifyFailure, opensCircuitImmediately, type TransportCause } from "./classify.ts";
import { sanitizeProviderText } from "./sanitize.ts";

export type SlotHealth =
  | "RECOVERING"
  | "HEALTHY"
  | "UNHEALTHY"
  | "OPEN"
  | "HALF_OPEN"
  | "ACCESS_DENIED"
  | "RATE_LIMITED"
  | "AUTH_FAILED";

interface Slot {
  id: string;
  secret: string;
  failures: number;
  successes: number;
  openedAt: number | null;
  lastError: string | null;
  lastSuccessAt: number | null;
  circuit: "CLOSED" | "OPEN" | "HALF_OPEN";
  lastCause: TransportCause | null;
}

const OPEN_AFTER = 3;
const OPEN_MS = 20_000;

export class KeyPool {
  private readonly slots: Slot[];
  private cursor = 0;

  constructor(entries: { id: string; secret: string }[]) {
    this.slots = entries.map((e) => ({
      id: e.id,
      secret: e.secret,
      failures: 0,
      successes: 0,
      openedAt: null,
      lastError: null,
      lastSuccessAt: null,
      circuit: "CLOSED" as const,
      lastCause: null,
    }));
  }

  get size() {
    return this.slots.length;
  }

  snapshot() {
    return this.slots.map((s) => ({
      id: s.id,
      state: classify(s),
      successes: s.successes,
      failures: s.failures,
      lastError: sanitizeProviderText(s.lastError),
      lastSuccessAt: s.lastSuccessAt,
    }));
  }

  async request<T>(exec: (secret: string) => Promise<T>): Promise<T> {
    const eligible = this.eligible();
    if (!eligible.length) throw new Error("No healthy credential slots");
    let lastError: unknown;
    for (const slot of eligible) {
      try {
        const result = await exec(slot.secret);
        this.recordSuccess(slot);
        return result;
      } catch (err) {
        lastError = err;
        this.recordFailure(slot, err);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private eligible(): Slot[] {
    const now = Date.now();
    const open = this.slots.filter((s) => {
      if (s.circuit === "OPEN") {
        if (s.openedAt != null && now - s.openedAt >= (s.lastCause && opensCircuitImmediately(s.lastCause) ? 120_000 : OPEN_MS)) {
          s.circuit = "HALF_OPEN";
          return true;
        }
        return false;
      }
      return true;
    });
    if (!open.length) return [];
    const start = this.cursor % open.length;
    this.cursor += 1;
    return [...open.slice(start), ...open.slice(0, start)];
  }

  private recordSuccess(s: Slot) {
    s.successes += 1;
    s.failures = 0;
    s.lastSuccessAt = Date.now();
    s.lastError = null;
    s.lastCause = null;
    s.circuit = "CLOSED";
    s.openedAt = null;
  }

  private recordFailure(s: Slot, err: unknown) {
    const cause = classifyFailure(err);
    s.failures += 1;
    s.lastCause = cause;
    s.lastError = err instanceof Error ? err.message : String(err);
    if (s.circuit === "HALF_OPEN" || s.failures >= OPEN_AFTER || opensCircuitImmediately(cause)) {
      s.circuit = "OPEN";
      s.openedAt = Date.now();
    }
  }
}

function classify(s: Slot): SlotHealth {
  if (s.lastCause === "ACCESS_DENIED") return "ACCESS_DENIED";
  if (s.lastCause === "AUTH_FAILED") return "AUTH_FAILED";
  if (s.lastCause === "RATE_LIMITED") return "RATE_LIMITED";
  if (s.circuit === "OPEN") return "OPEN";
  if (s.circuit === "HALF_OPEN") return "HALF_OPEN";
  if (s.failures > 0 && s.successes === 0) return "UNHEALTHY";
  if (s.lastSuccessAt) return "HEALTHY";
  return "RECOVERING";
}

export function isRetryableProviderStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 429 || status >= 500;
}
