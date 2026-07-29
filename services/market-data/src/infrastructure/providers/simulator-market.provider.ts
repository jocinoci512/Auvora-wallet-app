import { Injectable } from '@nestjs/common';
import type {
  MarketDataProviderPort,
  MarketQuote,
  OhlcBar,
  SupportedMarketNetwork,
  TokenMetadataSnapshot,
  TrendingAsset,
} from '../../domain/market-provider.port';

type Seed = {
  symbol: string;
  name: string;
  network: SupportedMarketNetwork;
  price: number;
  marketCap: number;
  volume24h: number;
  circulating: number;
  decimals: number;
  coingeckoId: string;
};

const SEEDS: Seed[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    network: 'BITCOIN',
    price: 65_000,
    marketCap: 1_280_000_000_000,
    volume24h: 28_000_000_000,
    circulating: 19_700_000,
    decimals: 8,
    coingeckoId: 'bitcoin',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    network: 'ETHEREUM',
    price: 3_500,
    marketCap: 420_000_000_000,
    volume24h: 14_000_000_000,
    circulating: 120_000_000,
    decimals: 18,
    coingeckoId: 'ethereum',
  },
  {
    symbol: 'BNB',
    name: 'BNB',
    network: 'BNB_SMART_CHAIN',
    price: 580,
    marketCap: 85_000_000_000,
    volume24h: 1_800_000_000,
    circulating: 147_000_000,
    decimals: 18,
    coingeckoId: 'binancecoin',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    network: 'SOLANA',
    price: 150,
    marketCap: 70_000_000_000,
    volume24h: 2_400_000_000,
    circulating: 460_000_000,
    decimals: 9,
    coingeckoId: 'solana',
  },
  {
    symbol: 'TRX',
    name: 'TRON',
    network: 'TRON',
    price: 0.12,
    marketCap: 10_500_000_000,
    volume24h: 450_000_000,
    circulating: 87_000_000_000,
    decimals: 6,
    coingeckoId: 'tron',
  },
];

function dayFactor(): number {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return ((day % 21) - 10) / 100; // -0.10 .. +0.10
}

function fmt(n: number, digits = 8): string {
  return n.toFixed(digits);
}

function quoteFromSeed(seed: Seed): MarketQuote {
  const change = dayFactor() + (seed.symbol.charCodeAt(0) % 7) / 1000;
  const price = seed.price * (1 + change * 0.15);
  return {
    symbol: seed.symbol,
    network: seed.network,
    contractAddress: null,
    priceUsd: fmt(price),
    change24hPct: fmt(change * 100, 4),
    change7dPct: fmt(change * 180, 4),
    marketCapUsd: fmt(seed.marketCap * (1 + change * 0.1), 2),
    volume24hUsd: fmt(seed.volume24h * (1 + Math.abs(change)), 2),
    circulatingSupply: fmt(seed.circulating, 2),
    fullyDilutedValuationUsd: fmt(seed.marketCap * 1.05 * (1 + change * 0.1), 2),
    source: 'simulator',
    asOf: new Date().toISOString(),
  };
}

function findSeed(symbol: string, network?: SupportedMarketNetwork): Seed | undefined {
  const sym = symbol.trim().toUpperCase();
  return SEEDS.find((s) => s.symbol === sym && (!network || s.network === network));
}

@Injectable()
export class SimulatorMarketProvider implements MarketDataProviderPort {
  readonly code = 'simulator';
  readonly name = 'Local Market Simulator';

  async getNativePrice(
    symbol: string,
    network: SupportedMarketNetwork,
  ): Promise<MarketQuote | null> {
    const seed = findSeed(symbol, network) ?? findSeed(symbol);
    return seed ? quoteFromSeed(seed) : null;
  }

  async getTokenPrice(
    contractAddress: string,
    network: SupportedMarketNetwork,
  ): Promise<MarketQuote | null> {
    // Deterministic pseudo-token from contract hash
    const hash = [...contractAddress.toLowerCase()].reduce((a, c) => a + c.charCodeAt(0), 0);
    const price = 0.5 + (hash % 5000) / 100;
    return {
      symbol: `TKN${(hash % 1000).toString().padStart(3, '0')}`,
      network,
      contractAddress,
      priceUsd: fmt(price),
      change24hPct: fmt(dayFactor() * 100, 4),
      change7dPct: fmt(dayFactor() * 150, 4),
      marketCapUsd: fmt(price * 50_000_000, 2),
      volume24hUsd: fmt(price * 1_200_000, 2),
      circulatingSupply: fmt(50_000_000, 2),
      fullyDilutedValuationUsd: fmt(price * 80_000_000, 2),
      source: 'simulator',
      asOf: new Date().toISOString(),
    };
  }

  async getHistoricalPrices(
    symbol: string,
    network: SupportedMarketNetwork,
    from: Date,
    to: Date,
  ): Promise<Array<{ asOf: string; priceUsd: string }>> {
    const seed = findSeed(symbol, network) ?? findSeed(symbol);
    if (!seed) return [];
    const out: Array<{ asOf: string; priceUsd: string }> = [];
    const step = Math.max(3_600_000, Math.floor((to.getTime() - from.getTime()) / 48));
    for (let t = from.getTime(); t <= to.getTime(); t += step) {
      const wobble = Math.sin(t / 86_400_000) * 0.02;
      out.push({ asOf: new Date(t).toISOString(), priceUsd: fmt(seed.price * (1 + wobble)) });
    }
    return out;
  }

  async getOhlc(
    symbol: string,
    network: SupportedMarketNetwork,
    interval: 'MINUTE' | 'HOUR' | 'DAY',
    from: Date,
    to: Date,
  ): Promise<OhlcBar[]> {
    const seed = findSeed(symbol, network) ?? findSeed(symbol);
    if (!seed) return [];
    const stepMs = interval === 'MINUTE' ? 60_000 : interval === 'HOUR' ? 3_600_000 : 86_400_000;
    const bars: OhlcBar[] = [];
    for (let t = from.getTime(); t <= to.getTime(); t += stepMs) {
      const base = seed.price * (1 + Math.sin(t / stepMs / 10) * 0.01);
      const open = base;
      const close = base * (1 + dayFactor() * 0.05);
      const high = Math.max(open, close) * 1.005;
      const low = Math.min(open, close) * 0.995;
      bars.push({
        bucketStart: new Date(t).toISOString(),
        open: fmt(open),
        high: fmt(high),
        low: fmt(low),
        close: fmt(close),
        volume: fmt(seed.volume24h / (interval === 'DAY' ? 1 : interval === 'HOUR' ? 24 : 1440), 2),
      });
    }
    return bars;
  }

  async getMarketStats(
    symbol: string,
    network: SupportedMarketNetwork,
  ): Promise<MarketQuote | null> {
    return this.getNativePrice(symbol, network);
  }

  async getTrending(): Promise<TrendingAsset[]> {
    return SEEDS.map((seed, index) => {
      const q = quoteFromSeed(seed);
      return {
        symbol: seed.symbol,
        network: seed.network,
        priceUsd: q.priceUsd,
        change24hPct: q.change24hPct ?? '0',
        volume24hUsd: q.volume24hUsd,
        rank: index + 1,
      };
    }).sort((a, b) => Number(b.change24hPct) - Number(a.change24hPct));
  }

  async getTokenMetadata(
    symbol: string,
    network: SupportedMarketNetwork,
  ): Promise<TokenMetadataSnapshot | null> {
    const seed = findSeed(symbol, network) ?? findSeed(symbol);
    if (!seed) return null;
    return {
      symbol: seed.symbol,
      name: seed.name,
      network: seed.network,
      logoUrl: null,
      decimals: seed.decimals,
      contractAddress: null,
      tokenType: 'NATIVE',
      verificationStatus: 'VERIFIED',
      circulatingSupply: fmt(seed.circulating, 2),
      totalSupply: fmt(seed.circulating * 1.02, 2),
      maxSupply: seed.symbol === 'BTC' ? fmt(21_000_000, 2) : null,
      externalIds: { coingeckoId: seed.coingeckoId },
    };
  }

  listSeeds(): Seed[] {
    return [...SEEDS];
  }
}
