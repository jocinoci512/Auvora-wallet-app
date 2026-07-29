import { Inject, Injectable, Logger } from '@nestjs/common';
import { PriceAlertCondition, PriceAlertStatus, PrismaService } from '@auvora/database';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors';
import { MARKET_EVENT_ALERT_TRIGGERED } from '../../domain/events';
import { pushLatency, withMarketSpan } from '../../domain/otel';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
import { MarketProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { MarketDataEngineService } from './market-data-engine.service';
import type { SupportedMarketNetwork } from '../../domain/market-provider.port';

export type CreateAlertInput = {
  metadataId?: string;
  symbol?: string;
  network?: string;
  condition: PriceAlertCondition | string;
  threshold: string;
  quoteCurrency?: string;
  cooldownSeconds?: number;
};

@Injectable()
export class PriceAlertService {
  private readonly logger = new Logger(PriceAlertService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(MarketDataEngineService) private readonly market: MarketDataEngineService,
    @Inject(MarketProviderRegistry) private readonly registry: MarketProviderRegistry,
  ) {}

  async list(ownerUserId: string) {
    const rows = await this.prisma.priceAlert.findMany({
      where: { ownerUserId, status: { not: PriceAlertStatus.CANCELLED } },
      include: { assetMetadata: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.map(r));
  }

  async create(ownerUserId: string, input: CreateAlertInput) {
    const metadataId = await this.resolveMetadataId(input);
    const condition = this.parseCondition(input.condition);
    const row = await this.prisma.priceAlert.create({
      data: {
        ownerUserId,
        metadataId,
        condition,
        threshold: input.threshold,
        quoteCurrency: input.quoteCurrency ?? 'USD',
        cooldownSeconds: input.cooldownSeconds ?? 3600,
      },
      include: { assetMetadata: true },
    });
    return this.map(row);
  }

  async cancel(ownerUserId: string, alertId: string) {
    const existing = await this.prisma.priceAlert.findUnique({ where: { id: alertId } });
    if (!existing || existing.ownerUserId !== ownerUserId) {
      throw new NotFoundError('Alert not found');
    }
    const row = await this.prisma.priceAlert.update({
      where: { id: alertId },
      data: { status: PriceAlertStatus.CANCELLED },
      include: { assetMetadata: true },
    });
    return this.map(row);
  }

  async evaluateActive(): Promise<number> {
    return withMarketSpan('market.alert.evaluate', {}, async () => {
      const started = Date.now();
      let triggered = 0;
      try {
        const alerts = await this.prisma.priceAlert.findMany({
          where: { status: PriceAlertStatus.ACTIVE },
          include: { assetMetadata: true },
          take: 200,
        });
        for (const alert of alerts) {
          if (await this.evaluateOne(alert)) triggered += 1;
        }
      } catch (error) {
        this.logger.debug(
          `alert evaluate skipped: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      pushLatency(this.registry.metrics.alertProcessingMs, Date.now() - started);
      return triggered;
    });
  }

  /** Pure evaluation helper for unit tests. */
  static shouldTrigger(
    condition: PriceAlertCondition | string,
    threshold: number,
    price: number,
    change24hPct: number | null,
    volumeSpikeRatio: number | null,
  ): boolean {
    switch (condition) {
      case PriceAlertCondition.ABOVE_PRICE:
      case 'ABOVE_PRICE':
        return price >= threshold;
      case PriceAlertCondition.BELOW_PRICE:
      case 'BELOW_PRICE':
        return price <= threshold;
      case PriceAlertCondition.PERCENTAGE_MOVEMENT:
      case 'PERCENTAGE_MOVEMENT':
      case PriceAlertCondition.DAILY_MOVEMENT:
      case 'DAILY_MOVEMENT':
        return change24hPct != null && Math.abs(change24hPct) >= threshold;
      case PriceAlertCondition.LARGE_VOLUME_MOVEMENT:
      case 'LARGE_VOLUME_MOVEMENT':
        return volumeSpikeRatio != null && volumeSpikeRatio >= threshold;
      default:
        return false;
    }
  }

  private async evaluateOne(alert: {
    id: string;
    ownerUserId: string;
    condition: PriceAlertCondition;
    threshold: { toNumber?: () => number; toString(): string };
    cooldownSeconds: number;
    lastTriggeredAt: Date | null;
    assetMetadata: { symbol: string; network: string };
  }): Promise<boolean> {
    if (
      alert.lastTriggeredAt &&
      Date.now() - alert.lastTriggeredAt.getTime() < alert.cooldownSeconds * 1000
    ) {
      return false;
    }
    const quote = await this.market.getQuote(
      alert.assetMetadata.symbol,
      alert.assetMetadata.network as SupportedMarketNetwork,
    );
    if (!quote) return false;
    const price = Number(quote.priceUsd);
    const change = quote.change24hPct != null ? Number(quote.change24hPct) : null;
    const threshold = Number(alert.threshold.toString());
    const hit = PriceAlertService.shouldTrigger(alert.condition, threshold, price, change, null);
    if (!hit) return false;

    await this.prisma.priceAlert.update({
      where: { id: alert.id },
      data: { status: PriceAlertStatus.TRIGGERED, lastTriggeredAt: new Date() },
    });
    await this.notifications.publishEvent({
      eventType: MARKET_EVENT_ALERT_TRIGGERED,
      aggregateId: alert.id,
      payload: {
        ownerUserId: alert.ownerUserId,
        alertId: alert.id,
        symbol: alert.assetMetadata.symbol,
        condition: alert.condition,
        threshold: String(threshold),
        price: quote.priceUsd,
        category: 'MARKET',
      },
    });
    return true;
  }

  private async resolveMetadataId(input: CreateAlertInput): Promise<string> {
    if (input.metadataId) return input.metadataId;
    if (!input.symbol || !input.network) {
      throw new ValidationError('metadataId or symbol+network required');
    }
    const row = await this.prisma.assetMarketMetadata.findFirst({
      where: { symbol: input.symbol.toUpperCase(), network: input.network as never },
    });
    if (!row) throw new NotFoundError(`Metadata not found for ${input.symbol}`);
    return row.id;
  }

  private parseCondition(value: string): PriceAlertCondition {
    if (Object.values(PriceAlertCondition).includes(value as PriceAlertCondition)) {
      return value as PriceAlertCondition;
    }
    throw new ValidationError(`Invalid alert condition: ${value}`);
  }

  private map(row: {
    id: string;
    ownerUserId: string;
    metadataId: string;
    condition: PriceAlertCondition;
    threshold: { toString(): string };
    quoteCurrency: string;
    status: PriceAlertStatus;
    lastTriggeredAt: Date | null;
    cooldownSeconds: number;
    assetMetadata: { symbol: string; network: string; name: string };
  }) {
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      metadataId: row.metadataId,
      condition: row.condition,
      threshold: row.threshold.toString(),
      quoteCurrency: row.quoteCurrency,
      status: row.status,
      lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
      cooldownSeconds: row.cooldownSeconds,
      symbol: row.assetMetadata.symbol,
      network: row.assetMetadata.network,
      name: row.assetMetadata.name,
    };
  }

  assertOwner(ownerUserId: string, requesterId: string, isAdmin: boolean): void {
    if (ownerUserId !== requesterId && !isAdmin) {
      throw new ForbiddenError('Access denied');
    }
  }
}
