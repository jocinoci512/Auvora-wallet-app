/**
 * Client-side price failover: CoinGecko -> CoinCap -> cache.
 * Never treat seeded demo prices as live without labeling.
 */

export type PriceQuote = {
  id: string;
  symbol: string;
  usd: number;
  change24hPct?: number;
  source: 'coingecko' | 'coincap' | 'cache' | 'seeded';
  fetchedAt: string;
};

const CACHE_KEY = 'auvora_price_cache_v1';
const CACHE_TTL_MS = 5 * 60_000;

const COINGECKO_IDS: Record<string, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  sol: 'solana',
  bnb: 'binancecoin',
  matic: 'matic-network',
  pol: 'matic-network',
  trx: 'tron',
  usdc: 'usd-coin',
  usdt: 'tether',
};

const COINCAP_IDS: Record<string, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  sol: 'solana',
  bnb: 'binance-coin',
  matic: 'polygon',
  pol: 'polygon',
  trx: 'tron',
  usdc: 'usd-coin',
  usdt: 'tether',
};

type CacheBlob = { fetchedAt: string; quotes: PriceQuote[] };

function readCache(): CacheBlob | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheBlob;
  } catch {
    return null;
  }
}

function writeCache(quotes: PriceQuote[]): void {
  if (typeof window === 'undefined') return;
  const blob: CacheBlob = { fetchedAt: new Date().toISOString(), quotes };
  localStorage.setItem(CACHE_KEY, JSON.stringify(blob));
}

async function fetchCoinGecko(symbols: string[]): Promise<PriceQuote[] | null> {
  const wanted = new Set(symbols.map((s) => s.toLowerCase()));
  const ids = [...wanted]
    .map((s) => COINGECKO_IDS[s])
    .filter(Boolean)
    .join(',');
  if (!ids) return null;
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return null;
  const body = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
  const now = new Date().toISOString();
  const out: PriceQuote[] = [];
  for (const [sym, geckoId] of Object.entries(COINGECKO_IDS)) {
    if (!wanted.has(sym)) continue;
    const row = body[geckoId];
    if (row?.usd == null) continue;
    out.push({
      id: geckoId,
      symbol: sym.toUpperCase(),
      usd: row.usd,
      change24hPct: row.usd_24h_change,
      source: 'coingecko',
      fetchedAt: now,
    });
  }
  return out.length ? out : null;
}

async function fetchCoinCap(symbols: string[]): Promise<PriceQuote[] | null> {
  const now = new Date().toISOString();
  const out: PriceQuote[] = [];
  await Promise.all(
    symbols.map(async (sym) => {
      const id = COINCAP_IDS[sym.toLowerCase()];
      if (!id) return;
      try {
        const res = await fetch(`https://api.coincap.io/v2/assets/${id}`, {
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          data?: { priceUsd?: string; changePercent24Hr?: string };
        };
        const usd = Number(body.data?.priceUsd);
        if (!Number.isFinite(usd)) return;
        out.push({
          id,
          symbol: sym.toUpperCase(),
          usd,
          change24hPct: Number(body.data?.changePercent24Hr) || undefined,
          source: 'coincap',
          fetchedAt: now,
        });
      } catch {
        /* next symbol */
      }
    }),
  );
  return out.length ? out : null;
}

export type PriceFetchResult = {
  quotes: PriceQuote[];
  live: boolean;
  sourceLabel: string;
};

/**
 * Resolve prices with failover. Seeded fallback is always labeled — never silent.
 */
export async function fetchPricesWithFailover(
  symbols: string[],
  seededFallback?: PriceQuote[],
): Promise<PriceFetchResult> {
  try {
    const gecko = await fetchCoinGecko(symbols);
    if (gecko?.length) {
      writeCache(gecko);
      return { quotes: gecko, live: true, sourceLabel: 'CoinGecko' };
    }
  } catch {
    /* failover */
  }

  try {
    const coincap = await fetchCoinCap(symbols);
    if (coincap?.length) {
      writeCache(coincap);
      return { quotes: coincap, live: true, sourceLabel: 'CoinCap' };
    }
  } catch {
    /* failover */
  }

  const cache = readCache();
  if (cache?.quotes?.length) {
    const age = Date.now() - new Date(cache.fetchedAt).getTime();
    if (age < CACHE_TTL_MS * 12) {
      return {
        quotes: cache.quotes.map((q) => ({ ...q, source: 'cache' as const })),
        live: false,
        sourceLabel: 'Cached prices',
      };
    }
  }

  if (seededFallback?.length) {
    return {
      quotes: seededFallback.map((q) => ({ ...q, source: 'seeded' as const })),
      live: false,
      sourceLabel: 'Demonstration prices (not live)',
    };
  }

  return { quotes: [], live: false, sourceLabel: 'Prices unavailable' };
}
