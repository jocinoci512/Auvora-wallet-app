import { RetentionService } from './retention.service';

const env = {
  MARKET_DATA_PRICE_RETENTION_DAYS: 90,
  MARKET_DATA_PORTFOLIO_RETENTION_DAYS: 180,
} as never;

describe('RetentionService', () => {
  it('prunes old price quotes in ID-keyed batches by cutoff', async () => {
    const prisma = {
      priceQuote: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
          .mockResolvedValueOnce([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      portfolioValueSnapshot: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
    };
    const service = new RetentionService(env, prisma as never);
    const result = await service.prune();

    expect(result.priceQuotes).toBe(2);
    // findMany filters by asOf < cutoff
    const where = prisma.priceQuote.findMany.mock.calls[0][0].where;
    expect(where.asOf.lt).toBeInstanceOf(Date);
    // deleteMany targets exactly the fetched ids (no broad unbounded delete)
    expect(prisma.priceQuote.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
    });
  });

  it('prunes portfolio snapshots and reports zero when nothing is old', async () => {
    const prisma = {
      priceQuote: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
      portfolioValueSnapshot: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'p1' }])
          .mockResolvedValueOnce([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new RetentionService(env, prisma as never);
    const result = await service.prune();

    expect(result.priceQuotes).toBe(0);
    expect(result.portfolioSnapshots).toBe(1);
  });
});
