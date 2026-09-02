interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache {
  private readonly map = new Map<string, Entry<unknown>>();

  get<T>(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): T {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  wrap<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return Promise.resolve(hit);
    return fn().then((value) => this.set(key, value, ttlMs));
  }
}

export const intelCache = new TtlCache();
