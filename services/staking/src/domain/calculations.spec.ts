import {
  estimatedApyFromBps,
  formatAmount,
  parseAmount,
  projectedEarnings,
  validatorRankScore,
} from './calculations';

describe('staking reward calculations', () => {
  it('converts bps to APY percent', () => {
    expect(estimatedApyFromBps(380)).toBe(3.8);
  });

  it('projects earnings over a year', () => {
    expect(projectedEarnings(1000, 3.65, 365)).toBeCloseTo(36.5, 5);
  });

  it('ranks validators preferring APY and uptime', () => {
    const high = validatorRankScore({ apyPercent: 6, uptimePercent: 99, commissionPercent: 5 });
    const low = validatorRankScore({ apyPercent: 3, uptimePercent: 90, commissionPercent: 15 });
    expect(high).toBeGreaterThan(low);
  });

  it('parses and formats amounts', () => {
    expect(parseAmount('1.5')).toBe(1.5);
    expect(formatAmount(1.5)).toBe('1.5');
    expect(() => parseAmount('-1')).toThrow();
  });
});
