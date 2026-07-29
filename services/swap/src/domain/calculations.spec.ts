import { applySlippage, compareQuotesByOutput, parseAmount, priceImpactBps } from './calculations';

describe('swap calculations', () => {
  it('applies slippage to min received', () => {
    expect(applySlippage('100', 50)).toBe('99.5');
  });

  it('computes price impact bps', () => {
    expect(priceImpactBps(100, 99)).toBe(100);
  });

  it('parses positive amounts', () => {
    expect(parseAmount('1.5')).toBe(1.5);
  });

  it('prefers higher amountOut then lower impact', () => {
    const a = { amountOut: '10', priceImpactBps: 5 };
    const b = { amountOut: '11', priceImpactBps: 8 };
    expect(compareQuotesByOutput(a, b)).toBeGreaterThan(0);
  });
});
