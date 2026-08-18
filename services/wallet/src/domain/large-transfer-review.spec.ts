import { evaluateLargeTransferUsdCents } from './large-transfer-review';

describe('evaluateLargeTransferUsdCents', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  it('requires review at $10,000 notional using integer cents', () => {
    const decision = evaluateLargeTransferUsdCents({
      amountSmallest: 1_000_000_000_000_000_000n,
      decimals: 18,
      usdCentsPerWholeToken: 1_000_000n,
      priceAt: now,
      now,
    });
    expect(decision.status).toBe('review_required');
  });

  it('does not require review below the threshold', () => {
    const decision = evaluateLargeTransferUsdCents({
      amountSmallest: 1_000_000_000_000_000_000n,
      decimals: 18,
      usdCentsPerWholeToken: 250_000n,
      priceAt: now,
      now,
    });
    expect(decision.status).toBe('below_threshold');
  });

  it('fails closed without a fresh price', () => {
    expect(
      evaluateLargeTransferUsdCents({
        amountSmallest: 1n,
        decimals: 18,
        usdCentsPerWholeToken: null,
        priceAt: now,
        now,
      }).status,
    ).toBe('price_unavailable');
  });
});
