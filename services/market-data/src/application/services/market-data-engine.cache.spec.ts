import { MarketDataEngineService } from './market-data-engine.service';

function build(store: Map<string, string>) {
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
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  };
  const freshQuote = {
    symbol: 'ETH',
    network: 'ETHEREUM',
    contractAddress: null,
    priceUsd: '3500',
    change24hPct: '1',
    change7dPct: null,
    marketCapUsd: '1',
    volume24hUsd: '1',
    circulatingSupply: null,
    fullyDilutedValuationUsd: null,
    source: 'coingecko',
    asOf: new Date().toISOString(),
  };
  const provider = {
    code: 'coingecko',
    name: 'cg',
    getNativePrice: jest.fn().mockResolvedValue(freshQuote),
    getNativePrices: jest.fn().mockResolvedValue([freshQuote]),
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
  return { service, provider, redis };
}

describe('MarketDataEngineService cache validation', () => {
  it('treats malformed cached JSON as a miss and refetches', async () => {
    const store = new Map<string, string>();
    store.set('md:price:ETHEREUM:ETH', '{not valid json');
    const { service, provider, redis } = build(store);

    const quote = await service.getQuote('ETH', 'ETHEREUM');
    expect(quote?.priceUsd).toBe('3500');
    expect(provider.getNativePrice).toHaveBeenCalledTimes(1);
    expect(redis.del).toHaveBeenCalledWith('md:price:ETHEREUM:ETH');
  });

  it('treats invalid cached quote (negative price) as a miss and refetches', async () => {
    const store = new Map<string, string>();
    store.set(
      'md:price:ETHEREUM:ETH',
      JSON.stringify({
        symbol: 'ETH',
        network: 'ETHEREUM',
        priceUsd: '-5',
        source: 'x',
        asOf: 'x',
      }),
    );
    const { service, provider } = build(store);

    const quote = await service.getQuote('ETH', 'ETHEREUM');
    expect(quote?.priceUsd).toBe('3500');
    expect(provider.getNativePrice).toHaveBeenCalledTimes(1);
  });
});
