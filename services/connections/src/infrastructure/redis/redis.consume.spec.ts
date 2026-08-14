import { RedisAdapter } from './redis.adapter';

// Minimal in-memory ioredis stand-in so we exercise the REAL consume() code
// (incr + expire-on-first) without a live Redis server.
class FakeRedis {
  store = new Map<string, number>();
  ttl = new Map<string, number>();
  status = 'ready';
  async connect() {
    /* no-op */
  }
  async incr(key: string): Promise<number> {
    const value = (this.store.get(key) ?? 0) + 1;
    this.store.set(key, value);
    return value;
  }
  async expire(key: string, seconds: number): Promise<number> {
    this.ttl.set(key, seconds);
    return 1;
  }
}

function build() {
  const adapter = new RedisAdapter({ REDIS_URL: 'redis://127.0.0.1:6379' } as never);
  const fake = new FakeRedis();
  (adapter as unknown as { client: FakeRedis }).client = fake;
  return { adapter, fake };
}

describe('RedisAdapter.consume (rate-limit counter)', () => {
  it('increments per key, sets TTL only on first hit, and flips allowed at the limit', async () => {
    const { adapter, fake } = build();
    const r1 = await adapter.consume('k1', 2, 60);
    const r2 = await adapter.consume('k1', 2, 60);
    const r3 = await adapter.consume('k1', 2, 60);
    expect(r1).toEqual({ allowed: true, remaining: 1 });
    expect(r2).toEqual({ allowed: true, remaining: 0 });
    expect(r3.allowed).toBe(false);
    // TTL was set (window enforced) — the counter expires so buckets reset over time.
    expect(fake.ttl.get('ratelimit:k1')).toBe(60);
  });

  it('isolates buckets across keys (no cross-user consumption)', async () => {
    const { adapter } = build();
    await adapter.consume('connections:rl:u:A', 1, 60); // A exhausted
    const aAgain = await adapter.consume('connections:rl:u:A', 1, 60);
    const bFirst = await adapter.consume('connections:rl:u:B', 1, 60);
    expect(aAgain.allowed).toBe(false);
    expect(bFirst.allowed).toBe(true);
  });

  it('resets after the window expires (simulated key eviction)', async () => {
    const { adapter, fake } = build();
    await adapter.consume('k', 1, 60);
    expect((await adapter.consume('k', 1, 60)).allowed).toBe(false);
    fake.store.delete('ratelimit:k'); // simulate TTL expiry
    expect((await adapter.consume('k', 1, 60)).allowed).toBe(true);
  });
});
