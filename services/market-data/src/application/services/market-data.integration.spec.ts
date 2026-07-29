import { SimulatorMarketProvider } from '../../infrastructure/providers/simulator-market.provider';
import { PriceAlertService } from './price-alert.service';
import { PortfolioIntelligenceService } from './portfolio-intelligence.service';

describe('market-data integration (mocked)', () => {
  it('prices + portfolio + alert rules work together', async () => {
    const provider = new SimulatorMarketProvider();
    const eth = await provider.getNativePrice('ETH', 'ETHEREUM');
    expect(eth).not.toBeNull();

    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
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
      getQuote: jest.fn().mockResolvedValue(eth),
    };
    const registry = { metrics: { portfolioCalcMs: [] as number[] } };
    const portfolio = new PortfolioIntelligenceService(
      { MARKET_DATA_PORTFOLIO_CACHE_TTL_SECONDS: 30 } as never,
      redis as never,
      prisma as never,
      market as never,
      registry as never,
    );
    const snap = await portfolio.valueHoldings('u1', [
      {
        assetCode: 'ETH',
        assetSymbol: 'ETH',
        assetChain: 'ETHEREUM',
        quantity: '1',
      },
    ]);
    expect(Number(snap.totalValueUsd)).toBeGreaterThan(0);
    expect(
      PriceAlertService.shouldTrigger(
        'ABOVE_PRICE',
        Number(eth!.priceUsd) - 1,
        Number(eth!.priceUsd),
        null,
        null,
      ),
    ).toBe(true);
  });
});
