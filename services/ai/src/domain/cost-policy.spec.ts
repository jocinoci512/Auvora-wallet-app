import { estimateCostUsdMicros, getModelRate } from './cost-policy';

describe('cost-policy', () => {
  it('returns zero cost for the free simulator model', () => {
    expect(estimateCostUsdMicros('sim-gpt', 1000, 1000)).toBe(0);
  });

  it('computes cost proportional to token counts for a known model', () => {
    const rate = getModelRate('gpt-4o-mini');
    const cost = estimateCostUsdMicros('gpt-4o-mini', 1000, 1000);
    expect(cost).toBe(rate.input + rate.output);
  });

  it('scales linearly with token count', () => {
    const cost1k = estimateCostUsdMicros('gpt-4o-mini', 1000, 0);
    const cost2k = estimateCostUsdMicros('gpt-4o-mini', 2000, 0);
    expect(cost2k).toBe(cost1k * 2);
  });

  it('falls back to the default rate for unknown models', () => {
    const cost = estimateCostUsdMicros('unknown-model-xyz', 1000, 1000);
    expect(cost).toBeGreaterThan(0);
  });

  it('returns 0 for zero tokens', () => {
    expect(estimateCostUsdMicros('gpt-4o', 0, 0)).toBe(0);
  });
});
