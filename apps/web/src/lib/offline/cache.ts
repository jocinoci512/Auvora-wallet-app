/**
 * Soft client cache for portfolio snapshots and asset metadata.
 * Survives reloads; TTL + offline read fallbacks. Corrupt entries are dropped.
 */

const PREFIX = 'auvora.offline.v1:';

type CacheEnvelope<T> = {
  savedAt: number;
  ttlMs: number;
  payload: T;
};

function key(ns: string, id: string): string {
  return `${PREFIX}${ns}:${id}`;
}

export function writeOfflineCache<T>(
  ns: string,
  id: string,
  payload: T,
  ttlMs = 1000 * 60 * 30,
): void {
  if (typeof window === 'undefined') return;
  try {
    const envelope: CacheEnvelope<T> = { savedAt: Date.now(), ttlMs, payload };
    localStorage.setItem(key(ns, id), JSON.stringify(envelope));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function readOfflineCache<T>(
  ns: string,
  id: string,
  opts?: { allowStale?: boolean },
): { data: T; stale: boolean; savedAt: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key(ns, id));
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope || typeof envelope.savedAt !== 'number' || envelope.payload === undefined) {
      localStorage.removeItem(key(ns, id));
      return null;
    }
    const age = Date.now() - envelope.savedAt;
    const stale = age > (envelope.ttlMs || 0);
    if (stale && !opts?.allowStale) return null;
    return { data: envelope.payload, stale, savedAt: envelope.savedAt };
  } catch {
    try {
      localStorage.removeItem(key(ns, id));
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** Prefer network; on failure or offline, fall back to stale cache. */
export async function withOfflineCache<T>(
  ns: string,
  id: string,
  loader: () => Promise<T>,
  ttlMs = 1000 * 60 * 30,
): Promise<{ data: T; fromCache: boolean; stale: boolean }> {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (!online) {
    const cached = readOfflineCache<T>(ns, id, { allowStale: true });
    if (cached) {
      return { data: cached.data, fromCache: true, stale: cached.stale };
    }
  }
  try {
    const data = await loader();
    writeOfflineCache(ns, id, data, ttlMs);
    return { data, fromCache: false, stale: false };
  } catch (error) {
    const cached = readOfflineCache<T>(ns, id, { allowStale: true });
    if (cached) {
      return { data: cached.data, fromCache: true, stale: cached.stale };
    }
    throw error;
  }
}

export const OFFLINE_CACHE_NS = {
  portfolio: 'portfolio',
  assetMeta: 'asset-meta',
  me: 'me-profile',
  networkMeta: 'network-meta',
  diagnostics: 'diagnostics',
  help: 'help',
  prices: 'prices',
  settingsSafe: 'settings-safe',
} as const;

export function clearOfflineCache(ns?: string): number {
  if (typeof window === 'undefined') return 0;
  const needle = ns ? `${PREFIX}${ns}:` : PREFIX;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith(needle)) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
  return keys.length;
}

/** Drop corrupt or expired entries. Keeps portfolio/prices for SWR unless force. */
export function purgeExpiredOfflineCache(opts?: { force?: boolean }): number {
  if (typeof window === 'undefined') return 0;
  const force = opts?.force === true;
  const keepSwr = new Set<string>([OFFLINE_CACHE_NS.portfolio, OFFLINE_CACHE_NS.prices]);
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  let removed = 0;
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const envelope = JSON.parse(raw) as CacheEnvelope<unknown>;
      if (!envelope || typeof envelope.savedAt !== 'number') {
        localStorage.removeItem(k);
        removed += 1;
        continue;
      }
      const expired = Date.now() - envelope.savedAt > (envelope.ttlMs || 0);
      const ns = k.slice(PREFIX.length).split(':')[0] ?? '';
      if (force) {
        localStorage.removeItem(k);
        removed += 1;
        continue;
      }
      if (expired && !keepSwr.has(ns)) {
        localStorage.removeItem(k);
        removed += 1;
      }
    } catch {
      localStorage.removeItem(k);
      removed += 1;
    }
  }
  return removed;
}

export function offlineCacheNamespaceSizes(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  const counts: Record<string, number> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    const ns = k.slice(PREFIX.length).split(':')[0] ?? 'unknown';
    counts[ns] = (counts[ns] ?? 0) + 1;
  }
  return counts;
}
