import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ChainNetwork, type Prisma, PrismaService } from '@auvora/database';
import { applySlippage } from '../../domain/calculations';
import { SWAP_EVENTS } from '../../domain/events';
import { SwapValidationError } from '../../domain/errors';
import {
  SWAP_PROVIDER,
  type SwapProviderPort,
  type SwapQuoteRequest,
} from '../../domain/swap-provider.port';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';
import { AI_PUBLISHER, type AiPublisherPort } from '../../infrastructure/ai/ai-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import { SwapProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { CLOCK, ID_GENERATOR, type ClockPort, type IdGeneratorPort } from '../ports/clock.port';
import { RoutingEngineService } from './routing-engine.service';
import { SwapExecutionService } from './swap-execution.service';

@Injectable()
export class SwapEngineService {
  private readonly logger = new Logger(SwapEngineService.name);

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SWAP_PROVIDER) private readonly providers: SwapProviderPort,
    @Inject(SwapProviderRegistry) private readonly registry: SwapProviderRegistry,
    @Inject(RoutingEngineService) private readonly routing: RoutingEngineService,
    @Inject(SwapExecutionService) private readonly execution: SwapExecutionService,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(AI_PUBLISHER) private readonly ai: AiPublisherPort,
  ) {}

  listNetworks() {
    return this.providers.getSupportedNetworks();
  }

  async listAssets(network: ChainNetwork) {
    return this.providers.getSupportedAssets(network);
  }

  async quote(userId: string, raw: SwapQuoteRequest) {
    const request = this.normalizeRequest(raw);
    const cacheKey = `swap:quote:${request.network}:${request.sellToken}:${request.buyToken}:${request.sellAmount}:${request.slippageBps}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

    const started = Date.now();
    const comparison = await this.routing.compareRoutes(request);
    const best = comparison.bestRoute
      ? await this.registry.getQuote(request)
      : await this.providers.getQuote(request);
    const latencyMs = Date.now() - started;

    const record = await this.prisma.swapQuoteRecord.create({
      data: {
        id: this.ids.uuid(),
        userId,
        network: request.network,
        providerCode: best.providerCode,
        providerQuoteId: best.providerQuoteId,
        sellToken: best.sellToken,
        buyToken: best.buyToken,
        sellAmount: best.sellAmount,
        amountOut: best.amountOut,
        minAmountOut: best.minAmountOut,
        slippageBps: request.slippageBps ?? this.env.SWAP_DEFAULT_SLIPPAGE_BPS,
        priceImpactBps: best.priceImpactBps,
        estimatedGas: best.estimatedGas,
        estimatedFeeNative: best.estimatedFeeNative,
        feeAmount: best.feeAmount,
        feeAsset: best.feeAsset,
        routeSummary: best.routeSummary,
        expiresAt: new Date(best.expiresAt),
        latencyMs,
        rawQuote: best as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.swapRouteSnapshot.create({
      data: {
        id: this.ids.uuid(),
        quoteId: record.id,
        providerCode: best.providerCode,
        routeId: best.route.routeId,
        amountOut: best.amountOut,
        priceImpactBps: best.priceImpactBps,
        hops: best.route.hops as unknown as Prisma.InputJsonValue,
        isBest: true,
      },
    });

    for (const route of comparison.routes ?? []) {
      if (route.routeId === best.route.routeId) continue;
      await this.prisma.swapRouteSnapshot.create({
        data: {
          id: this.ids.uuid(),
          quoteId: record.id,
          providerCode: route.providerCode,
          routeId: route.routeId,
          amountOut: route.amountOut,
          priceImpactBps: route.priceImpactBps,
          hops: route.hops as unknown as Prisma.InputJsonValue,
          isBest: false,
        },
      });
    }

    const payload = {
      quoteId: record.id,
      ...best,
      minAmountOut: applySlippage(
        best.amountOut,
        request.slippageBps ?? this.env.SWAP_DEFAULT_SLIPPAGE_BPS,
      ),
      routesCompared: comparison.routes?.length ?? 1,
      quoteLatencyMs: latencyMs,
      estimatedCompletionSeconds: best.route.estimatedCompletionSeconds,
    };

    await this.redis.set(cacheKey, JSON.stringify(payload), this.env.SWAP_QUOTE_TTL_SECONDS);
    void this.analytics.publishEvent({
      eventType: 'swap.quote.created',
      aggregateId: record.id,
      payload: {
        domain: 'SWAP',
        userId,
        network: request.network,
        latencyMs,
        provider: best.providerCode,
        priceImpactBps: best.priceImpactBps,
      },
    });
    void this.ai.publish(SWAP_EVENTS.QUOTE_CREATED, {
      userId,
      network: request.network,
      sellToken: best.sellToken,
      buyToken: best.buyToken,
    });

    return payload;
  }

  async routes(userId: string, raw: SwapQuoteRequest) {
    void userId;
    return this.routing.compareRoutes(this.normalizeRequest(raw));
  }

  prepare(userId: string, body: SwapQuoteRequest & { quoteId: string; providerCode: string }) {
    return this.execution.prepare(userId, body);
  }

  async execute(
    userId: string,
    body: { executionId: string; confirmed: boolean; signedTxHash?: string },
  ) {
    const result = await this.execution.execute(userId, body);
    void this.notifications.publishEvent({
      eventType: 'swap.submitted',
      aggregateId: result.id,
      payload: {
        userId,
        executionId: result.id,
        network: result.network,
      },
    });
    void this.analytics.publishEvent({
      eventType: 'swap.executed',
      aggregateId: result.id,
      payload: {
        domain: 'SWAP',
        userId,
        executionId: result.id,
        provider: result.providerCode,
      },
    });
    return result;
  }

  monitor(executionId: string) {
    return this.execution.monitor(executionId);
  }

  async history(userId: string, limit = 50) {
    return this.prisma.swapExecution.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  async receipt(userId: string, executionId: string) {
    const receipt = await this.prisma.swapReceipt.findFirst({
      where: { executionId, userId },
    });
    if (!receipt) {
      const execution = await this.prisma.swapExecution.findFirst({
        where: { id: executionId, userId },
      });
      return execution;
    }
    return receipt;
  }

  private normalizeRequest(raw: SwapQuoteRequest): SwapQuoteRequest {
    const slippageBps = raw.slippageBps ?? this.env.SWAP_DEFAULT_SLIPPAGE_BPS;
    if (slippageBps > this.env.SWAP_MAX_SLIPPAGE_BPS) {
      throw new SwapValidationError(`slippageBps exceeds max ${this.env.SWAP_MAX_SLIPPAGE_BPS}`);
    }
    if (!raw.sellToken || !raw.buyToken) {
      throw new SwapValidationError('sellToken and buyToken are required');
    }
    if (raw.sellToken.toUpperCase() === raw.buyToken.toUpperCase()) {
      throw new SwapValidationError('sellToken and buyToken must differ');
    }
    return {
      ...raw,
      sellToken: raw.sellToken.toUpperCase(),
      buyToken: raw.buyToken.toUpperCase(),
      slippageBps,
    };
  }
}
