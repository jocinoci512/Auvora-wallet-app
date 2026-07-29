/**
 * Soft client cache for portfolio snapshots and asset metadata.
 * Survives reloads; TTL + offline read fallbacks.
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
      return null;
    }
    const age = Date.now() - envelope.savedAt;
    const stale = age > (envelope.ttlMs || 0);
    if (stale && !opts?.allowStale) return null;
    return { data: envelope.payload, stale, savedAt: envelope.savedAt };
  } catch {
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
} as const;
