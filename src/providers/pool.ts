import type { ChainKey, ProviderHealthState, ProviderSnapshot } from "@/core/types";
import { alchemyHttpUrl } from "./secrets.ts";

export interface ProviderConfig {
  id: string;
  chainKey: ChainKey;
  url: string;
  priority: number;
}

interface InternalState {
  failures: number;
  successes: number;
  openedAt: number | null;
  lastError: string | null;
  lastSuccessAt: number | null;
  lastLatencyMs: number | null;
  circuit: "CLOSED" | "OPEN" | "HALF_OPEN";
}

const OPEN_AFTER = 3;
const OPEN_MS = 20_000;
const DEGRADED_LATENCY = 1200;

export class ProviderPool {
  private readonly configs: ProviderConfig[];
  private readonly state = new Map<string, InternalState>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(configs: ProviderConfig[]) {
    this.configs = configs;
    for (const c of configs) {
      this.state.set(c.id, {
        failures: 0,
        successes: 0,
        openedAt: null,
        lastError: null,
        lastSuccessAt: null,
        lastLatencyMs: null,
        circuit: "CLOSED",
      });
    }
  }

  snapshot(): ProviderSnapshot[] {
    return this.configs.map((c) => {
      const s = this.state.get(c.id)!;
      return {
        id: c.id,
        chainKey: c.chainKey,
        url: redactUrl(c.url),
        state: classify(s),
        latencyMs: s.lastLatencyMs,
        lastError: s.lastError,
        lastSuccessAt: s.lastSuccessAt,
        failures: s.failures,
      };
    });
  }

  providersFor(chainKey: ChainKey): ProviderConfig[] {
    const now = Date.now();
    return this.configs
      .filter((c) => c.chainKey === chainKey)
      .filter((c) => {
        const s = this.state.get(c.id)!;
        if (s.circuit === "OPEN") {
          if (s.openedAt != null && now - s.openedAt >= OPEN_MS) {
            s.circuit = "HALF_OPEN";
            return true;
          }
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const sa = this.state.get(a.id)!;
        const sb = this.state.get(b.id)!;
        const la = sa.lastLatencyMs ?? 10_000;
        const lb = sb.lastLatencyMs ?? 10_000;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return la - lb;
      });
  }

  async request<T>(
    chainKey: ChainKey,
    key: string,
    exec: (url: string) => Promise<T>,
  ): Promise<T> {
    const dedupeKey = `${chainKey}:${key}`;
    const existing = this.inflight.get(dedupeKey);
    if (existing) return existing as Promise<T>;

    const run = this.executeWithFailover(chainKey, exec);
    this.inflight.set(dedupeKey, run);
    try {
      return await run;
    } finally {
      this.inflight.delete(dedupeKey);
    }
  }

  private async executeWithFailover<T>(
    chainKey: ChainKey,
    exec: (url: string) => Promise<T>,
  ): Promise<T> {
    const providers = this.providersFor(chainKey);
    if (!providers.length) {
      throw new Error(`No healthy providers for ${chainKey}`);
    }
    let lastError: unknown;
    for (const provider of providers) {
      const started = Date.now();
      try {
        const result = await withTimeout(exec(provider.url), 8_000);
        this.recordSuccess(provider.id, Date.now() - started);
        return result;
      } catch (err) {
        lastError = err;
        this.recordFailure(provider.id, err);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private recordSuccess(id: string, latencyMs: number) {
    const s = this.state.get(id);
    if (!s) return;
    s.successes += 1;
    s.failures = 0;
    s.lastLatencyMs = latencyMs;
    s.lastSuccessAt = Date.now();
    s.lastError = null;
    s.circuit = "CLOSED";
    s.openedAt = null;
  }

  private recordFailure(id: string, err: unknown) {
    const s = this.state.get(id);
    if (!s) return;
    s.failures += 1;
    s.lastError = err instanceof Error ? err.message : String(err);
    if (s.circuit === "HALF_OPEN" || s.failures >= OPEN_AFTER) {
      s.circuit = "OPEN";
      s.openedAt = Date.now();
    }
  }
}

function classify(s: InternalState): ProviderHealthState {
  if (s.circuit === "OPEN") return "OPEN";
  if (s.circuit === "HALF_OPEN") return "HALF_OPEN";
  if (s.failures > 0 && s.successes === 0) return "UNHEALTHY";
  if ((s.lastLatencyMs ?? 0) >= DEGRADED_LATENCY) return "DEGRADED";
  if (s.lastSuccessAt) return "HEALTHY";
  return "RECOVERING";
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Provider timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function alchemyProviders(): ProviderConfig[] {
  const out: ProviderConfig[] = [];
  for (const chain of ["eth", "base", "ink"] as ChainKey[]) {
    const url = alchemyHttpUrl(chain);
    if (url) out.push({ id: `alchemy-${chain}`, chainKey: chain, url, priority: 0 });
  }
  return out;
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  ...alchemyProviders(),
  { id: "eth-publicnode", chainKey: "eth", url: "https://ethereum.publicnode.com", priority: 1 },
  { id: "eth-mevblocker", chainKey: "eth", url: "https://rpc.mevblocker.io", priority: 2 },
  { id: "eth-drpc", chainKey: "eth", url: "https://eth.drpc.org", priority: 3 },
  { id: "rh-official", chainKey: "rh", url: "https://rpc.mainnet.chain.robinhood.com", priority: 1 },
  { id: "rh-publicnode", chainKey: "rh", url: "https://robinhood-rpc.publicnode.com", priority: 2 },
  { id: "ink-gel", chainKey: "ink", url: "https://rpc-gel.inkonchain.com", priority: 1 },
  { id: "base-publicnode", chainKey: "base", url: "https://base.publicnode.com", priority: 1 },
  { id: "base-official", chainKey: "base", url: "https://mainnet.base.org", priority: 2 },
];

let sharedPool: ProviderPool | null = null;

export function getPool(): ProviderPool {
  if (!sharedPool) sharedPool = new ProviderPool(DEFAULT_PROVIDERS);
  return sharedPool;
}
