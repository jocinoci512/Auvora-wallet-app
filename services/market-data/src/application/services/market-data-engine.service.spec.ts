import { MarketDataEngineService } from './market-data-engine.service';

describe('MarketDataEngineService caching', () => {
  it('serves cached quotes and tracks hit ratio', async () => {
    const store = new Map<string, string>();
    const redis = {
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      del: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      ping: jest.fn(),
      getClient: jest.fn(),
    };
    const provider = {
      code: 'simulator',
      name: 'sim',
      getNativePrice: jest.fn().mockResolvedValue({
        symbol: 'ETH',
        network: 'ETHEREUM',
        priceUsd: '3500',
        change24hPct: '1',
        change7dPct: null,
        marketCapUsd: '1',
        volume24hUsd: '1',
        circulatingSupply: null,
        fullyDilutedValuationUsd: null,
        source: 'simulator',
        asOf: new Date().toISOString(),
      }),
      getTrending: jest.fn().mockResolvedValue([]),
    };
    const registry = {
      metrics: {
        priceRefreshLatencyMs: [] as number[],
        providerLatencyMs: [],
        portfolioCalcMs: [],
        alertProcessingMs: [],
        cacheHits: 0,
        cacheMisses: 0,
      },
    };
    const prisma = {
      assetMarketMetadata: { upsert: jest.fn().mockRejectedValue(new Error('skip')) },
      priceQuote: { create: jest.fn() },
    };

    const service = new MarketDataEngineService(
      {
        MARKET_DATA_PRICE_CACHE_TTL_SECONDS: 30,
        MARKET_DATA_TRENDING_CACHE_TTL_SECONDS: 60,
      } as never,
      provider as never,
      redis as never,
      prisma as never,
      registry as never,
    );

    const first = await service.getQuote('ETH', 'ETHEREUM');
    const second = await service.getQuote('ETH', 'ETHEREUM');
    expect(first?.priceUsd).toBe('3500');
    expect(second?.priceUsd).toBe('3500');
    expect(provider.getNativePrice).toHaveBeenCalledTimes(1);
    expect(registry.metrics.cacheMisses).toBe(1);
    expect(registry.metrics.cacheHits).toBe(1);
    expect(service.getObservabilitySnapshot().cacheHitRatio).toBe(0.5);
  });
});
