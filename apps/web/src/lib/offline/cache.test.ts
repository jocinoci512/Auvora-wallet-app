import {
  clearOfflineCache,
  OFFLINE_CACHE_NS,
  offlineCacheNamespaceSizes,
  purgeExpiredOfflineCache,
  readOfflineCache,
  writeOfflineCache,
} from './cache';

describe('offline cache', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const localStorageMock = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    };
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
  });

  it('writes and reads help namespace', () => {
    writeOfflineCache(OFFLINE_CACHE_NS.help, 'faq', [{ q: 'a', a: 'b' }], 60_000);
    const hit = readOfflineCache<{ q: string; a: string }[]>(OFFLINE_CACHE_NS.help, 'faq');
    expect(hit?.data[0]?.q).toBe('a');
    expect(offlineCacheNamespaceSizes().help).toBe(1);
  });

  it('drops corrupt entries', () => {
    store.set('auvora.offline.v1:help:bad', '{not-json');
    expect(readOfflineCache(OFFLINE_CACHE_NS.help, 'bad')).toBeNull();
    expect(store.has('auvora.offline.v1:help:bad')).toBe(false);
  });

  it('purges expired non-SWR namespaces', () => {
    writeOfflineCache(OFFLINE_CACHE_NS.help, 'old', { x: 1 }, 1);
    writeOfflineCache(OFFLINE_CACHE_NS.portfolio, 'active', { y: 2 }, 1);
    const helpKey = 'auvora.offline.v1:help:old';
    const raw = JSON.parse(store.get(helpKey)!);
    raw.savedAt = Date.now() - 10_000;
    store.set(helpKey, JSON.stringify(raw));
    const portKey = 'auvora.offline.v1:portfolio:active';
    const rawP = JSON.parse(store.get(portKey)!);
    rawP.savedAt = Date.now() - 10_000;
    store.set(portKey, JSON.stringify(rawP));

    const removed = purgeExpiredOfflineCache();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(store.has(helpKey)).toBe(false);
    expect(store.has(portKey)).toBe(true);
    expect(clearOfflineCache()).toBeGreaterThanOrEqual(1);
  });
});
