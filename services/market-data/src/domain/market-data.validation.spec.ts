import {
  isSupportedNetwork,
  parseFiniteNumber,
  sanitizeNonNegativeString,
  sanitizePercentString,
  sanitizePriceString,
  sanitizeQuote,
  sanitizeTrending,
} from './market-data.validation';

describe('market-data validation', () => {
  it('parseFiniteNumber rejects NaN/Infinity/malformed', () => {
    expect(parseFiniteNumber(42)).toBe(42);
    expect(parseFiniteNumber('42.5')).toBe(42.5);
    expect(parseFiniteNumber(NaN)).toBeNull();
    expect(parseFiniteNumber(Infinity)).toBeNull();
    expect(parseFiniteNumber(-Infinity)).toBeNull();
    expect(parseFiniteNumber('not-a-number')).toBeNull();
    expect(parseFiniteNumber('')).toBeNull();
    expect(parseFiniteNumber(null)).toBeNull();
  });

  it('sanitizePriceString requires a strictly-positive finite price', () => {
    expect(sanitizePriceString(100)).toBe('100');
    expect(sanitizePriceString('0')).toBeNull();
    expect(sanitizePriceString(-5)).toBeNull();
    expect(sanitizePriceString(Infinity)).toBeNull();
    expect(sanitizePriceString('abc')).toBeNull();
  });

  it('sanitizeNonNegativeString rejects negatives and non-finite', () => {
    expect(sanitizeNonNegativeString(0)).toBe('0');
    expect(sanitizeNonNegativeString(1000)).toBe('1000');
    expect(sanitizeNonNegativeString(-1)).toBeNull();
    expect(sanitizeNonNegativeString(NaN)).toBeNull();
    expect(sanitizeNonNegativeString(null)).toBeNull();
  });

  it('sanitizePercentString allows negatives but rejects non-finite', () => {
    expect(sanitizePercentString(-3.2)).toBe('-3.2');
    expect(sanitizePercentString(0)).toBe('0');
    expect(sanitizePercentString(Infinity)).toBeNull();
    expect(sanitizePercentString(null)).toBeNull();
  });

  it('isSupportedNetwork validates known networks only', () => {
    expect(isSupportedNetwork('ETHEREUM')).toBe(true);
    expect(isSupportedNetwork('BITCOIN')).toBe(true);
    expect(isSupportedNetwork('DOGECOIN')).toBe(false);
    expect(isSupportedNetwork(123)).toBe(false);
  });

  it('sanitizeQuote rejects invalid price, network, and malformed data', () => {
    expect(sanitizeQuote({ symbol: 'ETH', network: 'ETHEREUM', priceUsd: 3500 })).toMatchObject({
      symbol: 'ETH',
      network: 'ETHEREUM',
      priceUsd: '3500',
    });
    // negative price
    expect(sanitizeQuote({ symbol: 'ETH', network: 'ETHEREUM', priceUsd: -1 })).toBeNull();
    // NaN price
    expect(sanitizeQuote({ symbol: 'ETH', network: 'ETHEREUM', priceUsd: NaN })).toBeNull();
    // unknown network
    expect(sanitizeQuote({ symbol: 'ETH', network: 'FAKECHAIN', priceUsd: 1 })).toBeNull();
    // missing symbol
    expect(sanitizeQuote({ network: 'ETHEREUM', priceUsd: 1 })).toBeNull();
    // non-object
    expect(sanitizeQuote(null)).toBeNull();
    expect(sanitizeQuote('nope')).toBeNull();
  });

  it('sanitizeQuote drops malformed optional numeric fields without failing', () => {
    const q = sanitizeQuote({
      symbol: 'btc',
      network: 'BITCOIN',
      priceUsd: '65000',
      change24hPct: 'not-a-number',
      marketCapUsd: -5,
      volume24hUsd: 100,
    });
    expect(q).not.toBeNull();
    expect(q?.symbol).toBe('BTC');
    expect(q?.change24hPct).toBeNull();
    expect(q?.marketCapUsd).toBeNull();
    expect(q?.volume24hUsd).toBe('100');
  });

  it('sanitizeTrending returns null for non-array and filters bad entries', () => {
    expect(sanitizeTrending('nope')).toBeNull();
    const list = sanitizeTrending([
      { symbol: 'ETH', network: 'ETHEREUM', priceUsd: 3500, change24hPct: 1, rank: 1 },
      { symbol: 'BAD', network: 'NOPE', priceUsd: 1 },
    ]);
    expect(list).toHaveLength(1);
    expect(list?.[0].symbol).toBe('ETH');
  });
});
