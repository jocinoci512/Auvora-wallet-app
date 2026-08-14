import type { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { ConnectionsRateLimitError } from '../../domain/errors';

function ctx(
  path: string,
  opts: { user?: { sub?: string }; ip?: string; headers?: Record<string, string> } = {},
): ExecutionContext {
  const request = {
    path,
    url: path,
    ip: opts.ip ?? '1.2.3.4',
    headers: opts.headers ?? {},
    user: opts.user,
  };
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

// In-memory limiter that mirrors the real consume() contract (per-key counter),
// so we exercise the guard's real keying/enforcement logic.
function makeLimiter() {
  const buckets = new Map<string, number>();
  const consume = jest.fn(async (key: string, limit: number) => {
    const count = (buckets.get(key) ?? 0) + 1;
    buckets.set(key, count);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  });
  return { consume, buckets };
}

const env = { CONNECTIONS_RATE_LIMIT_MAX: 3, CONNECTIONS_RATE_LIMIT_WINDOW_SECONDS: 60 } as never;
const reflector = {} as never;

describe('Connections RateLimitGuard', () => {
  it('allows requests under the limit and throws 429 above it (per authenticated user)', async () => {
    const limiter = makeLimiter();
    const guard = new RateLimitGuard(env, limiter as never, reflector);
    const c = () => ctx('/api/v1/connections/sessions', { user: { sub: 'user-A' } });
    expect(await guard.canActivate(c())).toBe(true);
    expect(await guard.canActivate(c())).toBe(true);
    expect(await guard.canActivate(c())).toBe(true);
    await expect(guard.canActivate(c())).rejects.toBeInstanceOf(ConnectionsRateLimitError);
    expect(limiter.consume).toHaveBeenLastCalledWith('connections:rl:u:user-A', 3, 60);
  });

  it('keys authenticated users independently (one user cannot drain another bucket)', async () => {
    const limiter = makeLimiter();
    const guard = new RateLimitGuard(env, limiter as never, reflector);
    for (let i = 0; i < 3; i += 1) {
      await guard.canActivate(ctx('/api/v1/connections/x', { user: { sub: 'user-A' } }));
    }
    // user-A is now exhausted; user-B still has a fresh bucket
    await expect(
      guard.canActivate(ctx('/api/v1/connections/x', { user: { sub: 'user-A' } })),
    ).rejects.toBeInstanceOf(ConnectionsRateLimitError);
    expect(await guard.canActivate(ctx('/api/v1/connections/x', { user: { sub: 'user-B' } }))).toBe(
      true,
    );
  });

  it('keys unauthenticated requests by IP + path', async () => {
    const limiter = makeLimiter();
    const guard = new RateLimitGuard(env, limiter as never, reflector);
    await guard.canActivate(ctx('/api/v1/connections/x', { ip: '9.9.9.9' }));
    expect(limiter.consume).toHaveBeenCalledWith(
      'connections:rl:ip:9.9.9.9:/api/v1/connections/x',
      3,
      60,
    );
  });

  it('never throttles health/ready or internal mesh routes', async () => {
    const limiter = makeLimiter();
    const guard = new RateLimitGuard(env, limiter as never, reflector);
    expect(await guard.canActivate(ctx('/health'))).toBe(true);
    expect(await guard.canActivate(ctx('/ready'))).toBe(true);
    expect(await guard.canActivate(ctx('/api/v1/internal/connections/workers'))).toBe(true);
    expect(limiter.consume).not.toHaveBeenCalled();
  });

  it('soft-fails open when the limiter errors (Redis blip)', async () => {
    const limiter = { consume: jest.fn().mockRejectedValue(new Error('redis down')) };
    const guard = new RateLimitGuard(env, limiter as never, reflector);
    expect(await guard.canActivate(ctx('/api/v1/connections/x', { user: { sub: 'u' } }))).toBe(
      true,
    );
  });
});
