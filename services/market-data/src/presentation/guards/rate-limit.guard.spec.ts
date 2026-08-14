import type { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitError } from '../../domain/errors';

function ctx(path: string, user?: { sub?: string }): ExecutionContext {
  const request = { path, url: path, ip: '1.2.3.4', headers: {}, user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const env = {
  MARKET_DATA_RATE_LIMIT_MAX: 120,
  MARKET_DATA_RATE_LIMIT_WINDOW_SECONDS: 60,
} as never;
const reflector = {} as never;

describe('RateLimitGuard', () => {
  it('skips health and internal routes without consuming', async () => {
    const limiter = { consume: jest.fn() };
    const guard = new RateLimitGuard(env, limiter as never, reflector);
    expect(await guard.canActivate(ctx('/health'))).toBe(true);
    expect(await guard.canActivate(ctx('/ready'))).toBe(true);
    expect(await guard.canActivate(ctx('/api/v1/internal/market-data/quotes'))).toBe(true);
    expect(limiter.consume).not.toHaveBeenCalled();
  });

  it('allows requests under the limit and keys by user when present', async () => {
    const limiter = { consume: jest.fn().mockResolvedValue({ allowed: true, remaining: 5 }) };
    const guard = new RateLimitGuard(env, limiter as never, reflector);
    expect(await guard.canActivate(ctx('/api/v1/market-data/prices', { sub: 'user-1' }))).toBe(
      true,
    );
    expect(limiter.consume).toHaveBeenCalledWith('md:rl:u:user-1', 120, 60);
  });

  it('throws 429 when over the limit', async () => {
    const limiter = { consume: jest.fn().mockResolvedValue({ allowed: false, remaining: 0 }) };
    const guard = new RateLimitGuard(env, limiter as never, reflector);
    await expect(guard.canActivate(ctx('/api/v1/market-data/prices'))).rejects.toBeInstanceOf(
      RateLimitError,
    );
  });

  it('soft-fails open when the limiter errors (Redis blip)', async () => {
    const limiter = { consume: jest.fn().mockRejectedValue(new Error('redis down')) };
    const guard = new RateLimitGuard(env, limiter as never, reflector);
    expect(await guard.canActivate(ctx('/api/v1/market-data/prices'))).toBe(true);
  });
});
