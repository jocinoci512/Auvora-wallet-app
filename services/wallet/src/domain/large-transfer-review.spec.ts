import {
  evaluateLargeTransferUsdCents,
  resolveLargeTransferThresholdCents,
  DEFAULT_LARGE_TRANSFER_USD_CENTS,
  DEFAULT_TESTNET_LARGE_TRANSFER_USD_CENTS,
} from './large-transfer-review';

describe('resolveLargeTransferThresholdCents', () => {
  const previousLarge = process.env.LARGE_TRANSFER_USD_CENTS;
  const previousTestnet = process.env.TESTNET_LARGE_TRANSFER_USD_CENTS;

  afterEach(() => {
    if (previousLarge === undefined) delete process.env.LARGE_TRANSFER_USD_CENTS;
    else process.env.LARGE_TRANSFER_USD_CENTS = previousLarge;
    if (previousTestnet === undefined) delete process.env.TESTNET_LARGE_TRANSFER_USD_CENTS;
    else process.env.TESTNET_LARGE_TRANSFER_USD_CENTS = previousTestnet;
  });

  it('defaults mainnet to $10,000', () => {
    delete process.env.LARGE_TRANSFER_USD_CENTS;
    delete process.env.TESTNET_LARGE_TRANSFER_USD_CENTS;
    expect(resolveLargeTransferThresholdCents('mainnet')).toBe(DEFAULT_LARGE_TRANSFER_USD_CENTS);
    expect(resolveLargeTransferThresholdCents(undefined)).toBe(DEFAULT_LARGE_TRANSFER_USD_CENTS);
  });

  it('defaults testnet to $1.00 for QA', () => {
    delete process.env.LARGE_TRANSFER_USD_CENTS;
    delete process.env.TESTNET_LARGE_TRANSFER_USD_CENTS;
    expect(resolveLargeTransferThresholdCents('testnet')).toBe(
      DEFAULT_TESTNET_LARGE_TRANSFER_USD_CENTS,
    );
  });
});

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

  it('does not require review at $9,999.99 using integer cents', () => {
    const decision = evaluateLargeTransferUsdCents({
      amountSmallest: 1_000_000n,
      decimals: 6,
      usdCentsPerWholeToken: 999_999n,
      priceAt: now,
      now,
    });
    expect(decision.status).toBe('below_threshold');
    expect(decision.notionalUsdCents).toBe(999_999n);
  });

  it('requires review at exactly $10,000.00', () => {
    const decision = evaluateLargeTransferUsdCents({
      amountSmallest: 1_000_000n,
      decimals: 6,
      usdCentsPerWholeToken: 1_000_000n,
      priceAt: now,
      now,
    });
    expect(decision.status).toBe('review_required');
    expect(decision.notionalUsdCents).toBe(1_000_000n);
  });

  it('requires review at $10,000.01', () => {
    const decision = evaluateLargeTransferUsdCents({
      amountSmallest: 1_000_000n,
      decimals: 6,
      usdCentsPerWholeToken: 1_000_001n,
      priceAt: now,
      now,
    });
    expect(decision.status).toBe('review_required');
    expect(decision.notionalUsdCents).toBe(1_000_001n);
  });

  it('fails closed when the USD price is stale', () => {
    expect(
      evaluateLargeTransferUsdCents({
        amountSmallest: 1_000_000n,
        decimals: 6,
        usdCentsPerWholeToken: 1_000_000n,
        priceAt: new Date('2026-08-18T11:00:00.000Z'),
        now,
      }).status,
    ).toBe('stale_price');
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
