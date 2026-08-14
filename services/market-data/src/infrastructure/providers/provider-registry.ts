import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { ProviderUnavailableError } from '../../domain/errors';
import {
  MARKET_DATA_PROVIDER,
  type MarketDataProviderPort,
  type MarketQuote,
  type OhlcBar,
  type SupportedMarketNetwork,
  type TokenMetadataSnapshot,
  type TrendingAsset,
} from '../../domain/market-provider.port';
import { pushLatency, type MarketMetrics } from '../../domain/otel';
import { CoinGeckoMarketProvider } from './coingecko.provider';
import { SimulatorMarketProvider } from './simulator-market.provider';

@Injectable()
export class MarketProviderRegistry implements MarketDataProviderPort {
  readonly code: string;
  readonly name: string;
  private readonly logger = new Logger(MarketProviderRegistry.name);
  private readonly primary: MarketDataProviderPort;
  private readonly simulator: SimulatorMarketProvider;
  private readonly simulatorEnabled: boolean;
  readonly metrics: MarketMetrics = {
    priceRefreshLatencyMs: [],
    providerLatencyMs: [],
    portfolioCalcMs: [],
    alertProcessingMs: [],
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(
    @Inject(ENV) env: ServiceEnv,
    @Inject(SimulatorMarketProvider) simulator: SimulatorMarketProvider,
    @Inject(CoinGeckoMarketProvider) coingecko: CoinGeckoMarketProvider,
  ) {
    this.simulator = simulator;
    this.simulatorEnabled = env.MARKET_DATA_SIMULATOR_ENABLED;
    this.primary = this.simulatorEnabled ? simulator : coingecko;
    this.code = this.primary.code;
    this.name = this.primary.name;
    this.logger.log(
      `Market data provider active: ${this.code} (simulator=${this.simulatorEnabled})`,
    );
  }

  private async withLatency<T>(fn: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      return await fn();
    } finally {
      pushLatency(this.metrics.providerLatencyMs, Date.now() - started);
    }
  }

  private async withFallback<T>(fn: (p: MarketDataProviderPort) => Promise<T>): Promise<T> {
    try {
      return await this.withLatency(() => fn(this.primary));
    } catch (error) {
      // Never serve simulated/fake market data in production. When the simulator
      // is disabled (real mode), surface the provider failure instead of masking
      // it with fake prices. The simulator is only used as a fallback in dev,
      // where it is already the primary provider anyway.
      if (!this.simulatorEnabled || this.primary.code === this.simulator.code) {
        throw error;
      }
      this.logger.warn(
        `Primary provider failed, falling back to simulator: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.withLatency(() => fn(this.simulator));
    }
  }

  getNativePrice(symbol: string, network: SupportedMarketNetwork): Promise<MarketQuote | null> {
    return this.withFallback((p) => p.getNativePrice(symbol, network));
  }

  getTokenPrice(
    contractAddress: string,
    network: SupportedMarketNetwork,
  ): Promise<MarketQuote | null> {
    return this.withFallback((p) => p.getTokenPrice(contractAddress, network));
  }

  getHistoricalPrices(
    symbol: string,
    network: SupportedMarketNetwork,
    from: Date,
    to: Date,
  ): Promise<Array<{ asOf: string; priceUsd: string }>> {
    return this.withFallback((p) => p.getHistoricalPrices(symbol, network, from, to));
  }

  getOhlc(
    symbol: string,
    network: SupportedMarketNetwork,
    interval: 'MINUTE' | 'HOUR' | 'DAY',
    from: Date,
    to: Date,
  ): Promise<OhlcBar[]> {
    return this.withFallback((p) => p.getOhlc(symbol, network, interval, from, to));
  }

  getMarketStats(symbol: string, network: SupportedMarketNetwork): Promise<MarketQuote | null> {
    return this.withFallback((p) => p.getMarketStats(symbol, network));
  }

  getTrending(): Promise<TrendingAsset[]> {
    return this.withFallback((p) => p.getTrending());
  }

  getTokenMetadata(
    symbol: string,
    network: SupportedMarketNetwork,
  ): Promise<TokenMetadataSnapshot | null> {
    return this.withFallback((p) => p.getTokenMetadata(symbol, network));
  }

  requireQuote(quote: MarketQuote | null): MarketQuote {
    if (!quote) throw new ProviderUnavailableError('No quote available');
    return quote;
  }
}

export { MARKET_DATA_PROVIDER };
