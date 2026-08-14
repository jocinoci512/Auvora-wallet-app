import type { MarketQuote, SupportedMarketNetwork, TrendingAsset } from './market-provider.port';

export const SUPPORTED_NETWORKS: readonly SupportedMarketNetwork[] = [
  'ETHEREUM',
  'BNB_SMART_CHAIN',
  'SOLANA',
  'TRON',
  'BITCOIN',
];

export function isSupportedNetwork(value: unknown): value is SupportedMarketNetwork {
  return typeof value === 'string' && (SUPPORTED_NETWORKS as readonly string[]).includes(value);
}

/**
 * Parse a value into a finite number, rejecting NaN, Infinity, -Infinity and
 * malformed numeric strings. Returns null when the value cannot be trusted.
 */
export function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** A strictly-positive finite price as a canonical string, or null if invalid. */
export function sanitizePriceString(value: unknown): string | null {
  const n = parseFiniteNumber(value);
  if (n === null || n <= 0) return null;
  return String(n);
}

/** A finite, non-negative amount (market cap / volume / supply) as a string, or null. */
export function sanitizeNonNegativeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const n = parseFiniteNumber(value);
  if (n === null || n < 0) return null;
  return String(n);
}

/** A finite percentage change (may be negative) as a string, or null. */
export function sanitizePercentString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const n = parseFiniteNumber(value);
  if (n === null) return null;
  return String(n);
}

/**
 * Validate and normalize a market quote from a provider or the cache. Returns a
 * clean MarketQuote or null when the data cannot be trusted (invalid price,
 * unknown network, malformed numeric fields). Never coerces bad data into a
 * valid-looking quote.
 */
export function sanitizeQuote(raw: unknown): MarketQuote | null {
  if (!raw || typeof raw !== 'object') return null;
  const q = raw as Record<string, unknown>;

  if (typeof q.symbol !== 'string' || q.symbol.trim() === '') return null;
  if (!isSupportedNetwork(q.network)) return null;

  const priceUsd = sanitizePriceString(q.priceUsd);
  if (priceUsd === null) return null;

  const asOf =
    typeof q.asOf === 'string' && !Number.isNaN(Date.parse(q.asOf))
      ? q.asOf
      : new Date().toISOString();

  return {
    symbol: q.symbol.toUpperCase(),
    network: q.network,
    contractAddress: typeof q.contractAddress === 'string' ? q.contractAddress : null,
    priceUsd,
    change24hPct: sanitizePercentString(q.change24hPct),
    change7dPct: sanitizePercentString(q.change7dPct),
    marketCapUsd: sanitizeNonNegativeString(q.marketCapUsd),
    volume24hUsd: sanitizeNonNegativeString(q.volume24hUsd),
    circulatingSupply: sanitizeNonNegativeString(q.circulatingSupply),
    fullyDilutedValuationUsd: sanitizeNonNegativeString(q.fullyDilutedValuationUsd),
    source: typeof q.source === 'string' && q.source.trim() !== '' ? q.source : 'unknown',
    asOf,
  };
}

/** Validate a cached trending list; returns a clean list or null if malformed. */
export function sanitizeTrending(raw: unknown): TrendingAsset[] | null {
  if (!Array.isArray(raw)) return null;
  const out: TrendingAsset[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const t = entry as Record<string, unknown>;
    if (typeof t.symbol !== 'string' || !isSupportedNetwork(t.network)) continue;
    const priceUsd = sanitizeNonNegativeString(t.priceUsd) ?? '0';
    out.push({
      symbol: t.symbol.toUpperCase(),
      network: t.network,
      priceUsd,
      change24hPct: sanitizePercentString(t.change24hPct) ?? '0',
      volume24hUsd: sanitizeNonNegativeString(t.volume24hUsd),
      rank: parseFiniteNumber(t.rank) ?? out.length + 1,
    });
  }
  return out;
}
