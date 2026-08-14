import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ChainNetwork, PrismaService } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  MARKET_DATA_PROVIDER,
  type MarketDataProviderPort,
  type MarketQuote,
  type SupportedMarketNetwork,
  type TrendingAsset,
} from '../../domain/market-provider.port';
import { sanitizeQuote, sanitizeTrending } from '../../domain/market-data.validation';
import { avg, cacheHitRatio, pushLatency, withMarketSpan } from '../../domain/otel';
import { MarketProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';

const NATIVE_ASSETS: Array<{ symbol: string; network: SupportedMarketNetwork }> = [
  { symbol: 'BTC', network: 'BITCOIN' },
  { symbol: 'ETH', network: 'ETHEREUM' },
  { symbol: 'BNB', network: 'BNB_SMART_CHAIN' },
  { symbol: 'SOL', network: 'SOLANA' },
  { symbol: 'TRX', network: 'TRON' },
];

@Injectable()
export class MarketDataEngineService {
  private readonly logger = new Logger(MarketDataEngineService.name);

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(MARKET_DATA_PROVIDER) private readonly provider: MarketDataProviderPort,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MarketProviderRegistry) private readonly registry: MarketProviderRegistry,
  ) {}

  getObservabilitySnapshot() {
    const m = this.registry.metrics;
    return {
      avgPriceRefreshLatencyMs: avg(m.priceRefreshLatencyMs),
      avgProviderLatencyMs: avg(m.providerLatencyMs),
      avgPortfolioCalcMs: avg(m.portfolioCalcMs),
      avgAlertProcessingMs: avg(m.alertProcessingMs),
      cacheHitRatio: cacheHitRatio(m),
      cacheHits: m.cacheHits,
      cacheMisses: m.cacheMisses,
      activeProvider: this.provider.code,
    };
  }

  async getQuote(symbol: string, network: SupportedMarketNetwork): Promise<MarketQuote | null> {
    return withMarketSpan(
      'market.price.refresh',
      { symbol, network, provider: this.provider.code },
      async () => {
        const cacheKey = `md:price:${network}:${symbol.toUpperCase()}`;
        const fromCache = await this.readQuoteCache(cacheKey);
        if (fromCache) {
          this.registry.metrics.cacheHits += 1;
          return fromCache;
        }
        this.registry.metrics.cacheMisses += 1;
        const started = Date.now();
        const quote = await this.provider.getNativePrice(symbol, network);
        pushLatency(this.registry.metrics.priceRefreshLatencyMs, Date.now() - started);
        if (quote) {
          await this.redis.set(
            cacheKey,
            JSON.stringify(quote),
            this.env.MARKET_DATA_PRICE_CACHE_TTL_SECONDS,
          );
          await this.persistQuote(quote);
        }
        return quote;
      },
    );
  }

  async getQuotes(
    items: Array<{ symbol: string; network: SupportedMarketNetwork }>,
  ): Promise<MarketQuote[]> {
    const out: MarketQuote[] = [];
    for (const item of items) {
      const quote = await this.getQuote(item.symbol, item.network);
      if (quote) out.push(quote);
    }
    return out;
  }

  /** Read + validate a cached quote; a malformed entry is treated as a miss. */
  private async readQuoteCache(cacheKey: string): Promise<MarketQuote | null> {
    const cached = await this.redis.get(cacheKey);
    if (!cached) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(cached);
    } catch {
      this.logger.warn(`Discarding malformed cached quote at ${cacheKey}`);
      await this.redis.del(cacheKey);
      return null;
    }
    const quote = sanitizeQuote(parsed);
    if (!quote) {
      this.logger.warn(`Discarding invalid cached quote at ${cacheKey}`);
      await this.redis.del(cacheKey);
      return null;
    }
    return quote;
  }

  async getTrending(): Promise<TrendingAsset[]> {
    const cacheKey = 'md:trending';
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(cached);
      } catch {
        parsed = null;
      }
      const validated = sanitizeTrending(parsed);
      if (validated) {
        this.registry.metrics.cacheHits += 1;
        return validated;
      }
      this.logger.warn('Discarding malformed cached trending list');
      await this.redis.del(cacheKey);
    }
    this.registry.metrics.cacheMisses += 1;
    const trending = await this.provider.getTrending();
    await this.redis.set(
      cacheKey,
      JSON.stringify(trending),
      this.env.MARKET_DATA_TRENDING_CACHE_TTL_SECONDS,
    );
    return trending;
  }

  async getMarketOverview() {
    const quotes = await this.getQuotes(NATIVE_ASSETS);
    const trending = await this.getTrending();
    return {
      generatedAt: new Date().toISOString(),
      provider: this.provider.code,
      assets: quotes,
      trending,
      networks: NATIVE_ASSETS.map((a) => a.network),
    };
  }

  async refreshAllNativePrices(): Promise<number> {
    // Single batched upstream request for all native assets (was N requests).
    let quotes: MarketQuote[];
    try {
      quotes = await this.provider.getNativePrices(NATIVE_ASSETS);
    } catch (error) {
      this.logger.warn(
        `Batched price refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
    let count = 0;
    for (const quote of quotes) {
      try {
        await this.redis.set(
          `md:price:${quote.network}:${quote.symbol}`,
          JSON.stringify(quote),
          this.env.MARKET_DATA_PRICE_CACHE_TTL_SECONDS,
        );
        await this.persistQuote(quote);
        count += 1;
      } catch (error) {
        this.logger.warn(
          `Price persist failed for ${quote.symbol}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return count;
  }

  async invalidatePriceCache(): Promise<void> {
    for (const asset of NATIVE_ASSETS) {
      await this.redis.del(`md:price:${asset.network}:${asset.symbol}`);
    }
    await this.redis.del('md:trending');
  }

  private async persistQuote(quote: MarketQuote): Promise<void> {
    try {
      const metadata = await this.prisma.assetMarketMetadata.upsert({
        where: {
          network_symbol_contractAddress: {
            network: quote.network as ChainNetwork,
            symbol: quote.symbol,
            contractAddress: quote.contractAddress ?? '',
          },
        },
        create: {
          network: quote.network as ChainNetwork,
          symbol: quote.symbol,
          name: quote.symbol,
          contractAddress: quote.contractAddress ?? '',
          marketCapUsd: quote.marketCapUsd ?? undefined,
          volume24hUsd: quote.volume24hUsd ?? undefined,
          fullyDilutedValuationUsd: quote.fullyDilutedValuationUsd ?? undefined,
          circulatingSupply: quote.circulatingSupply ?? undefined,
          syncedAt: new Date(),
        },
        update: {
          marketCapUsd: quote.marketCapUsd ?? undefined,
          volume24hUsd: quote.volume24hUsd ?? undefined,
          fullyDilutedValuationUsd: quote.fullyDilutedValuationUsd ?? undefined,
          circulatingSupply: quote.circulatingSupply ?? undefined,
          syncedAt: new Date(),
        },
      });
      await this.prisma.priceQuote.create({
        data: {
          metadataId: metadata.id,
          price: quote.priceUsd,
          change24hPct: quote.change24hPct ?? undefined,
          change7dPct: quote.change7dPct ?? undefined,
          marketCapUsd: quote.marketCapUsd ?? undefined,
          volume24hUsd: quote.volume24hUsd ?? undefined,
          source: quote.source,
          asOf: new Date(quote.asOf),
        },
      });
    } catch (error) {
      this.logger.debug(
        `persistQuote skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
