import { PortfolioIntelligenceService } from './portfolio-intelligence.service';

describe('PortfolioIntelligenceService calculations', () => {
  it('values holdings with mocked quotes', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn(),
      ping: jest.fn(),
      getClient: jest.fn(),
    };
    const prisma = {
      portfolioValueSnapshot: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const market = {
      getQuote: jest.fn().mockImplementation(async (symbol: string) => ({
        symbol,
        network: 'ETHEREUM',
        priceUsd: symbol === 'ETH' ? '2000' : '100',
        change24hPct: '10',
        change7dPct: null,
        marketCapUsd: null,
        volume24hUsd: null,
        circulatingSupply: null,
        fullyDilutedValuationUsd: null,
        source: 'simulator',
        asOf: new Date().toISOString(),
      })),
    };
    const registry = {
      metrics: { portfolioCalcMs: [] as number[] },
    };

    const service = new PortfolioIntelligenceService(
      { MARKET_DATA_PORTFOLIO_CACHE_TTL_SECONDS: 60 } as never,
      redis as never,
      prisma as never,
      market as never,
      registry as never,
    );

    const snap = await service.valueHoldings('user-1', [
      {
        walletId: 'w1',
        assetCode: 'ETH',
        assetSymbol: 'ETH',
        assetChain: 'ETHEREUM',
        quantity: '2',
        costBasisUsd: '3000',
      },
      {
        walletId: 'w2',
        assetCode: 'BTC',
        assetSymbol: 'BTC',
        assetChain: 'BITCOIN',
        quantity: '1',
        costBasisUsd: '50',
      },
    ]);

    expect(snap.totalValueUsd).toBe('4100.00'); // 2*2000 + 1*100
    expect(snap.tokenAllocation).toHaveLength(2);
    expect(Number(snap.unrealizedProfitLossUsd)).toBe(1050); // (4000-3000)+(100-50)
    expect(snap.networkBreakdown.length).toBeGreaterThanOrEqual(1);
    expect(snap.largestHoldings[0]!.assetSymbol).toBe('ETH');
  });
});
