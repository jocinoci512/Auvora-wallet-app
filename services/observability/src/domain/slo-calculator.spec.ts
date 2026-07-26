import { calculateSli } from './slo-calculator';

describe('slo-calculator', () => {
  it('computes SLI and error budget', () => {
    const result = calculateSli({ goodEvents: 99, totalEvents: 100, targetPercent: 99 });
    expect(result.sliPercent).toBe(99);
    expect(result.errorBudgetRemaining).toBe(0);
    expect(result.reliabilityScore).toBe(99);
  });

  it('handles empty totals as perfect', () => {
    expect(calculateSli({ goodEvents: 0, totalEvents: 0, targetPercent: 99 }).sliPercent).toBe(100);
  });
});
