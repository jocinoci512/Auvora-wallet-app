export type CacheStats = {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  staleServes: number;
  hotKeys: Record<string, number>;
};

export function createCacheStats(): CacheStats {
  return { hits: 0, misses: 0, sets: 0, deletes: 0, staleServes: 0, hotKeys: {} };
}

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPrefix?(prefix: string): Promise<number>;
}

type MemoryEntry = { value: string; expiresAt: number };

export class MemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, MemoryEntry>();

  async get(key: string): Promise<string | null> {
    const entry = this.map.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.map.delete(key);
  }

  async delByPrefix(prefix: string): Promise<number> {
    let removed = 0;
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) {
        this.map.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  size(): number {
    return this.map.size;
  }
}

export type CacheClientOptions = {
  store: CacheStore;
  defaultTtlSeconds?: number;
  keyPrefix?: string;
  stats?: CacheStats;
  hotKeyThreshold?: number;
};

export class CacheClient {
  private readonly store: CacheStore;
  private readonly defaultTtlSeconds: number;
  private readonly keyPrefix: string;
  private readonly stats: CacheStats;
  private readonly hotKeyThreshold: number;

  constructor(options: CacheClientOptions) {
    this.store = options.store;
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 60;
    this.keyPrefix = options.keyPrefix ?? '';
    this.stats = options.stats ?? createCacheStats();
    this.hotKeyThreshold = options.hotKeyThreshold ?? 100;
  }

  getStats(): CacheStats {
    return this.stats;
  }

  getHotKeys(limit = 10): Array<{ key: string; hits: number }> {
    return Object.entries(this.stats.hotKeys)
      .map(([key, hits]) => ({ key, hits }))
      .filter((row) => row.hits >= this.hotKeyThreshold)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
  }

  private namespaced(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private trackHit(key: string): void {
    this.stats.hits += 1;
    this.stats.hotKeys[key] = (this.stats.hotKeys[key] ?? 0) + 1;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.store.get(this.namespaced(key));
    if (raw === null) {
      this.stats.misses += 1;
      return null;
    }
    this.trackHit(key);
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = this.defaultTtlSeconds): Promise<void> {
    await this.store.set(this.namespaced(key), JSON.stringify(value), ttlSeconds);
    this.stats.sets += 1;
  }

  async invalidate(key: string): Promise<void> {
    await this.store.del(this.namespaced(key));
    this.stats.deletes += 1;
  }

  async invalidatePrefix(prefix: string): Promise<number> {
    if (!this.store.delByPrefix) {
      return 0;
    }
    const removed = await this.store.delByPrefix(this.namespaced(prefix));
    this.stats.deletes += removed;
    return removed;
  }

  /** Read-through: return cached value or load, store, and return. */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds = this.defaultTtlSeconds,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /** Write-through: write to source then cache. */
  async writeThrough<T>(
    key: string,
    value: T,
    writer: (value: T) => Promise<void>,
    ttlSeconds = this.defaultTtlSeconds,
  ): Promise<T> {
    await writer(value);
    await this.set(key, value, ttlSeconds);
    return value;
  }

  hitRatio(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }
}

/** Recommended TTLs (seconds) for platform domains — measurable defaults. */
export const CACHE_TTL = {
  session: 300,
  walletBalance: 15,
  blockchainFee: 30,
  analyticsDashboard: 60,
  aiRequest: 120,
  featureFlag: 60,
  rateLimitBucket: 60,
} as const;
