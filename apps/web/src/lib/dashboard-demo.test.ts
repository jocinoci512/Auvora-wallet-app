import { applyQuotes, DEMO_HOLDINGS, formatUsd, portfolioTotals } from './dashboard-demo';

describe('dashboard money helpers', () => {
  it('formats USD with two decimals', () => {
    expect(formatUsd(1284.5)).toBe('$1,284.50');
  });

  it('applies quotes without inventing balances', () => {
    const next = applyQuotes(
      [{ ...DEMO_HOLDINGS[0]!, balance: 1, valueUsd: 0, priceUsd: 0 }],
      [{ symbol: 'BTC', usd: 100, change24hPct: 1 }],
    );
    expect(next[0]?.balance).toBe(1);
    expect(next[0]?.valueUsd).toBe(100);
    expect(portfolioTotals(next).total).toBe(100);
  });
});
