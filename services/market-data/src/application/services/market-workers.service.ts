import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { withMarketSpan } from '../../domain/otel';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';
import {
  WALLET_HTTP_CLIENT,
  type WalletHttpClientPort,
} from '../../infrastructure/wallet/wallet-http.client';
import { MarketDataEngineService } from './market-data-engine.service';
import { PortfolioIntelligenceService } from './portfolio-intelligence.service';
import { PriceAlertService } from './price-alert.service';
import { PriceHistoryService } from './price-history.service';
import { TokenMetadataService } from './token-metadata.service';

type WorkerName = 'price' | 'metadata' | 'portfolio' | 'cache' | 'history' | 'alert';

@Injectable()
export class MarketWorkersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketWorkersService.name);
  private readonly timers = new Map<WorkerName, NodeJS.Timeout>();
  private readonly running = new Set<WorkerName>();
  private enabled = false;

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(MarketDataEngineService) private readonly market: MarketDataEngineService,
    @Inject(TokenMetadataService) private readonly metadata: TokenMetadataService,
    @Inject(PriceHistoryService) private readonly history: PriceHistoryService,
    @Inject(PortfolioIntelligenceService) private readonly portfolio: PortfolioIntelligenceService,
    @Inject(PriceAlertService) private readonly alerts: PriceAlertService,
    @Inject(WALLET_HTTP_CLIENT) private readonly wallet: WalletHttpClientPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
  ) {}

  onModuleInit(): void {
    this.enabled = this.env.MARKET_DATA_WORKERS_ENABLED;
    if (!this.enabled) {
      this.logger.log('Market data workers disabled (MARKET_DATA_WORKERS_ENABLED=false)');
      return;
    }
    this.logger.log('Initializing market data background workers');
    this.schedule('price', this.env.MARKET_DATA_PRICE_INTERVAL_MS, () => this.runPrice());
    this.schedule('metadata', this.env.MARKET_DATA_METADATA_INTERVAL_MS, () => this.runMetadata());
    this.schedule('portfolio', this.env.MARKET_DATA_PORTFOLIO_INTERVAL_MS, () =>
      this.runPortfolio(),
    );
    this.schedule('cache', this.env.MARKET_DATA_CACHE_INTERVAL_MS, () => this.runCache());
    this.schedule('history', this.env.MARKET_DATA_HISTORY_INTERVAL_MS, () => this.runHistory());
    this.schedule('alert', this.env.MARKET_DATA_ALERT_INTERVAL_MS, () => this.runAlerts());
    this.logger.log(
      'Market data workers initialized: price, metadata, portfolio, cache, history, alert',
    );
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
  }

  status() {
    return {
      enabled: this.enabled,
      running: this.enabled,
      active: [...this.running],
      workers: [...this.timers.keys()],
    };
  }

  private schedule(name: WorkerName, intervalMs: number, fn: () => Promise<void>): void {
    const timer = setInterval(() => {
      void fn();
    }, intervalMs);
    this.timers.set(name, timer);
  }

  private async track(name: WorkerName, fn: () => Promise<void>): Promise<void> {
    if (this.running.has(name)) return;
    this.running.add(name);
    try {
      await fn();
    } catch (error) {
      this.logger.warn(
        `Worker ${name} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running.delete(name);
    }
  }

  async runPrice(): Promise<void> {
    await this.track('price', async () => {
      await withMarketSpan('market.worker.price', {}, async () => {
        const count = await this.market.refreshAllNativePrices();
        await this.analytics.publishEvent({
          eventType: 'market.worker.price',
          payload: { count },
        });
      });
    });
  }

  async runMetadata(): Promise<void> {
    await this.track('metadata', async () => {
      await withMarketSpan('market.worker.metadata', {}, async () => {
        await this.metadata.syncNativeMetadata();
      });
    });
  }

  async runPortfolio(): Promise<void> {
    await this.track('portfolio', async () => {
      await withMarketSpan('market.worker.portfolio', {}, async () => {
        const owners = await this.wallet.listActiveOwnerIds();
        for (const ownerUserId of owners.slice(0, 25)) {
          const holdings = await this.wallet.getHoldings(ownerUserId);
          if (holdings.length) {
            await this.portfolio.valueHoldings(ownerUserId, holdings);
          }
        }
      });
    });
  }

  async runCache(): Promise<void> {
    await this.track('cache', async () => {
      await withMarketSpan('market.worker.cache', {}, async () => {
        await this.market.getTrending();
        await this.market.getMarketOverview();
      });
    });
  }

  async runHistory(): Promise<void> {
    await this.track('history', async () => {
      await withMarketSpan('market.worker.history', {}, async () => {
        await this.history.syncHistoryForNatives();
      });
    });
  }

  async runAlerts(): Promise<void> {
    await this.track('alert', async () => {
      await this.alerts.evaluateActive();
    });
  }
}
