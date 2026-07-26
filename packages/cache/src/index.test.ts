import { CACHE_TTL, CacheClient, MemoryCacheStore, createCacheStats } from './index';

describe('@auvora/cache', () => {
  it('read-through caches loader results', async () => {
    const stats = createCacheStats();
    const client = new CacheClient({
      store: new MemoryCacheStore(),
      defaultTtlSeconds: 30,
      stats,
    });
    let loads = 0;
    const first = await client.getOrSet('wallet:1', async () => {
      loads += 1;
      return { balance: 10 };
    });
    const second = await client.getOrSet('wallet:1', async () => {
      loads += 1;
      return { balance: 99 };
    });
    expect(first).toEqual({ balance: 10 });
    expect(second).toEqual({ balance: 10 });
    expect(loads).toBe(1);
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(client.hitRatio()).toBeCloseTo(0.5);
  });

  it('write-through updates cache after writer', async () => {
    const store = new MemoryCacheStore();
    const client = new CacheClient({ store, defaultTtlSeconds: 30 });
    let persisted: unknown;
    await client.writeThrough('user:1', { name: 'kwasi' }, async (value) => {
      persisted = value;
    });
    expect(persisted).toEqual({ name: 'kwasi' });
    await expect(client.get('user:1')).resolves.toEqual({ name: 'kwasi' });
  });

  it('invalidates keys and prefixes', async () => {
    const store = new MemoryCacheStore();
    const client = new CacheClient({ store, keyPrefix: 'auvora:' });
    await client.set('a:1', 1);
    await client.set('a:2', 2);
    await client.invalidate('a:1');
    await expect(client.get('a:1')).resolves.toBeNull();
    const removed = await client.invalidatePrefix('a:');
    expect(removed).toBe(1);
  });

  it('expires entries after TTL', async () => {
    jest.useFakeTimers();
    const store = new MemoryCacheStore();
    const client = new CacheClient({ store });
    await client.set('temp', 'x', 1);
    jest.advanceTimersByTime(1100);
    await expect(client.get('temp')).resolves.toBeNull();
    jest.useRealTimers();
  });

  it('exposes recommended TTL policy constants', () => {
    expect(CACHE_TTL.walletBalance).toBe(15);
    expect(CACHE_TTL.aiRequest).toBe(120);
  });
});
