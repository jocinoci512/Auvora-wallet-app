import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ChainNetwork, OhlcInterval, PrismaService } from '@auvora/database';
import {
  MARKET_DATA_PROVIDER,
  type MarketDataProviderPort,
  type OhlcBar,
  type SupportedMarketNetwork,
} from '../../domain/market-provider.port';
import { ValidationError } from '../../domain/errors';
import { withMarketSpan } from '../../domain/otel';

export type ChartRange = '1d' | '7d' | '30d' | '90d' | '1y' | 'all';

const RANGE_MS: Record<ChartRange, number> = {
  '1d': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  '90d': 90 * 86_400_000,
  '1y': 365 * 86_400_000,
  all: 5 * 365 * 86_400_000,
};

function intervalForRange(range: ChartRange): OhlcInterval {
  if (range === '1d') return OhlcInterval.MINUTE;
  if (range === '7d' || range === '30d') return OhlcInterval.HOUR;
  return OhlcInterval.DAY;
}

@Injectable()
export class PriceHistoryService {
  private readonly logger = new Logger(PriceHistoryService.name);

  constructor(
    @Inject(MARKET_DATA_PROVIDER) private readonly provider: MarketDataProviderPort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getChart(
    symbol: string,
    network: SupportedMarketNetwork,
    range: ChartRange,
  ): Promise<{ range: ChartRange; interval: OhlcInterval; bars: OhlcBar[] }> {
    if (!(range in RANGE_MS)) {
      throw new ValidationError(`Unsupported chart range: ${range}`);
    }
    return withMarketSpan('market.history.chart', { symbol, network, range }, async () => {
      const to = new Date();
      const from = new Date(to.getTime() - RANGE_MS[range]);
      const interval = intervalForRange(range);
      const bars = await this.provider.getOhlc(
        symbol,
        network,
        interval as 'MINUTE' | 'HOUR' | 'DAY',
        from,
        to,
      );
      await this.persistBars(symbol, network, interval, bars);
      return { range, interval, bars };
    });
  }

  async syncHistoryForNatives(): Promise<number> {
    const natives: Array<{ symbol: string; network: SupportedMarketNetwork }> = [
      { symbol: 'BTC', network: 'BITCOIN' },
      { symbol: 'ETH', network: 'ETHEREUM' },
      { symbol: 'BNB', network: 'BNB_SMART_CHAIN' },
      { symbol: 'SOL', network: 'SOLANA' },
      { symbol: 'TRX', network: 'TRON' },
    ];
    let count = 0;
    for (const asset of natives) {
      await this.getChart(asset.symbol, asset.network, '7d');
      count += 1;
    }
    return count;
  }

  private async persistBars(
    symbol: string,
    network: SupportedMarketNetwork,
    interval: OhlcInterval,
    bars: OhlcBar[],
  ): Promise<void> {
    try {
      const metadata = await this.prisma.assetMarketMetadata.findFirst({
        where: { symbol: symbol.toUpperCase(), network: network as ChainNetwork },
      });
      if (!metadata) return;
      for (const bar of bars.slice(-48)) {
        await this.prisma.ohlcCandle.upsert({
          where: {
            metadataId_interval_bucketStart: {
              metadataId: metadata.id,
              interval,
              bucketStart: new Date(bar.bucketStart),
            },
          },
          create: {
            metadataId: metadata.id,
            interval,
            bucketStart: new Date(bar.bucketStart),
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume ?? undefined,
            source: this.provider.code,
          },
          update: {
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume ?? undefined,
            source: this.provider.code,
          },
        });
      }
    } catch (error) {
      this.logger.debug(
        `persistBars skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
