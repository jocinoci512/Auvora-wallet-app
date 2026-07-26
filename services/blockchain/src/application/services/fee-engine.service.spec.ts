import { ChainNetwork, FeePriority } from '@auvora/database';
import type { ProviderFactoryPort } from '../ports/provider-factory.port';
import { FeeEngine } from './fee-engine.service';

describe('FeeEngine', () => {
  function createFactory(): ProviderFactoryPort {
    return {
      getProvider: jest.fn().mockReturnValue({
        estimateFee: jest.fn(async (priority: FeePriority) => {
          const base = 0.0001;
          const multipliers: Record<FeePriority, number> = {
            SLOW: 0.5,
            STANDARD: 1,
            FAST: 1.75,
            PRIORITY: 3,
          };
          return { amount: (base * multipliers[priority]).toFixed(8), unit: 'BTC' };
        }),
      }),
      getSupportedChains: jest.fn().mockReturnValue([ChainNetwork.BITCOIN]),
      hasProvider: jest.fn().mockReturnValue(true),
    };
  }

  it('estimates a fee for a given chain and priority', async () => {
    const engine = new FeeEngine(createFactory());
    const estimate = await engine.estimateFee(ChainNetwork.BITCOIN, FeePriority.STANDARD);
    expect(estimate.unit).toBe('BTC');
    expect(Number(estimate.amount)).toBeGreaterThan(0);
  });

  it('orders fee schedule amounts by priority: slow < standard < fast < priority', async () => {
    const engine = new FeeEngine(createFactory());
    const schedule = await engine.getFeeSchedule(ChainNetwork.BITCOIN);

    const slow = Number(schedule[FeePriority.SLOW].amount);
    const standard = Number(schedule[FeePriority.STANDARD].amount);
    const fast = Number(schedule[FeePriority.FAST].amount);
    const priority = Number(schedule[FeePriority.PRIORITY].amount);

    expect(slow).toBeLessThan(standard);
    expect(standard).toBeLessThan(fast);
    expect(fast).toBeLessThan(priority);
  });
});
