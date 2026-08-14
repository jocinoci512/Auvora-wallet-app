import { MarketWorkersService } from './market-workers.service';

function build(overrides: {
  market?: unknown;
  analytics?: unknown;
  redis?: unknown;
  env?: Record<string, unknown>;
}) {
  return new MarketWorkersService(
    { MARKET_DATA_WORKERS_ENABLED: false, ...(overrides.env ?? {}) } as never,
    (overrides.market ?? {}) as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    (overrides.analytics ?? { publishEvent: jest.fn() }) as never,
    {} as never,
    (overrides.redis ?? {}) as never,
  );
}

describe('MarketWorkersService', () => {
  it('does not schedule when disabled', () => {
    const service = build({});
    service.onModuleInit();
    expect(service.status().enabled).toBe(false);
    expect(service.status().workers).toEqual([]);
  });

  it('runs a worker when the distributed lock is acquired and releases it', async () => {
    const market = { refreshAllNativePrices: jest.fn().mockResolvedValue(3) };
    const redis = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };
    const service = build({ market, redis, analytics: { publishEvent: jest.fn() } });

    await service.runPrice();

    expect(redis.acquireLock).toHaveBeenCalledTimes(1);
    expect(market.refreshAllNativePrices).toHaveBeenCalledTimes(1);
    expect(redis.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('skips the worker when the distributed lock is not acquired', async () => {
    const market = { refreshAllNativePrices: jest.fn() };
    const redis = {
      acquireLock: jest.fn().mockResolvedValue(false),
      releaseLock: jest.fn(),
    };
    const service = build({ market, redis, analytics: { publishEvent: jest.fn() } });

    await service.runPrice();

    expect(redis.acquireLock).toHaveBeenCalledTimes(1);
    expect(market.refreshAllNativePrices).not.toHaveBeenCalled();
    expect(redis.releaseLock).not.toHaveBeenCalled();
  });
});
