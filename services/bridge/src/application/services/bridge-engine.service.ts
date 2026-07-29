import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ChainNetwork, type Prisma, PrismaService } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  BridgeConfirmationRequiredError,
  BridgeExpiredError,
  BridgeNotFoundError,
  BridgeUnsupportedRouteError,
  BridgeValidationError,
  BRIDGE_EVENTS,
  BRIDGE_PROVIDER,
  compareQuotesByOutput,
  isSameNetworkRoute,
  type BridgeProviderPort,
  type BridgeQuoteRequest,
} from '../../domain';
import { AI_PUBLISHER, type AiPublisherPort } from '../../infrastructure/ai/ai-publisher.adapter';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
import {
  FIELD_ENCRYPTION,
  type FieldEncryptionPort,
} from '../../infrastructure/crypto/field-encryption.adapter';
import { BridgeProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { CLOCK, ID_GENERATOR, type ClockPort, type IdGeneratorPort } from '../ports/clock.port';

@Injectable()
export class BridgeEngineService {
  private readonly logger = new Logger(BridgeEngineService.name);

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BRIDGE_PROVIDER) private readonly providers: BridgeProviderPort,
    @Inject(BridgeProviderRegistry) private readonly registry: BridgeProviderRegistry,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(FIELD_ENCRYPTION) private readonly crypto: FieldEncryptionPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(AI_PUBLISHER) private readonly ai: AiPublisherPort,
  ) {}

  listNetworks() {
    return this.providers.getSupportedNetworks();
  }

  async listRoutes() {
    return this.registry.listRoutes();
  }

  async listAssets(network: ChainNetwork) {
    return this.providers.getSupportedAssets(network);
  }

  async quote(userId: string, request: BridgeQuoteRequest) {
    this.validateRouteBasics(request);
    const started = Date.now();
    const quotes = await this.registry.collectQuotes(request);
    if (!quotes.length) {
      throw new BridgeUnsupportedRouteError('No bridge quote available for this route', {
        sourceNetwork: request.sourceNetwork,
        destinationNetwork: request.destinationNetwork,
        assetSymbol: request.assetSymbol,
      });
    }
    const best = [...quotes].sort(compareQuotesByOutput)[0]!;
    const row = await this.prisma.bridgeQuote.create({
      data: {
        id: this.ids.uuid(),
        userId,
        providerCode: best.providerCode,
        providerQuoteId: best.providerQuoteId,
        sourceNetwork: request.sourceNetwork,
        destinationNetwork: request.destinationNetwork,
        assetSymbol: request.assetSymbol,
        amountIn: best.amountIn,
        amountOut: best.amountOut,
        minAmountOut: best.minAmountOut,
        feeAmount: best.feeAmount,
        feeAsset: best.feeAsset,
        estimatedFeeNative: best.estimatedFeeNative,
        estimatedCompletionSeconds: best.estimatedCompletionSeconds,
        routeSummary: best.routeSummary,
        routeJson: best.route as unknown as Prisma.InputJsonValue,
        replayNonce: best.replayNonce,
        expiresAt: new Date(best.expiresAt),
        metadata: { alternatives: quotes.length } as Prisma.InputJsonValue,
      },
    });
    void this.analytics.publishEvent({
      eventType: BRIDGE_EVENTS.QUOTE_CREATED,
      aggregateId: row.id,
      payload: { userId, latencyMs: Date.now() - started, providerCode: best.providerCode },
    });
    return { quoteId: row.id, best, alternatives: quotes };
  }

  async prepare(
    userId: string,
    input: BridgeQuoteRequest & { quoteId: string; providerCode: string },
  ) {
    const quote = await this.prisma.bridgeQuote.findFirst({
      where: { id: input.quoteId, userId },
    });
    if (!quote) throw new BridgeNotFoundError('Quote not found');
    if (quote.expiresAt.getTime() < Date.now()) throw new BridgeExpiredError();
    this.validateRouteBasics(input);
    const prepared = await this.registry.prepareTransfer({
      ...input,
      providerQuoteId: quote.providerQuoteId,
    });
    if (!prepared.simulationOk) {
      throw new BridgeValidationError('Bridge simulation failed', {
        detail: prepared.simulationDetail,
      });
    }
    const transfer = await this.prisma.bridgeTransfer.create({
      data: {
        id: this.ids.uuid(),
        userId,
        quoteId: quote.id,
        providerCode: input.providerCode || quote.providerCode,
        providerQuoteId: quote.providerQuoteId,
        status: 'PENDING_CONFIRMATION',
        sourceNetwork: input.sourceNetwork,
        destinationNetwork: input.destinationNetwork,
        assetSymbol: input.assetSymbol,
        amountIn: quote.amountIn,
        amountOutExpected: quote.amountOut,
        feeAmount: quote.feeAmount,
        feeAsset: quote.feeAsset,
        estimatedCompletionSeconds: quote.estimatedCompletionSeconds,
        routeSummary: quote.routeSummary,
        preparedTx: prepared as unknown as Prisma.InputJsonValue,
        requiresConfirmation: true,
        replayNonce: quote.replayNonce,
        sourceAddress: input.sourceAddress,
        destinationAddress: input.destinationAddress,
      },
    });
    void this.analytics.publishEvent({
      eventType: BRIDGE_EVENTS.PREPARED,
      aggregateId: transfer.id,
      payload: { userId, providerCode: transfer.providerCode },
    });
    return {
      transferId: transfer.id,
      prepared,
      requiresConfirmation: true,
      feeBreakdown: {
        feeAmount: quote.feeAmount,
        feeAsset: quote.feeAsset,
        estimatedFeeNative: quote.estimatedFeeNative,
      },
      estimatedCompletionSeconds: quote.estimatedCompletionSeconds,
      routeSummary: quote.routeSummary,
    };
  }

  async confirm(userId: string, transferId: string, confirmed: boolean) {
    const transfer = await this.prisma.bridgeTransfer.findFirst({
      where: { id: transferId, userId },
    });
    if (!transfer) throw new BridgeNotFoundError();
    if (!confirmed) throw new BridgeConfirmationRequiredError();
    if (transfer.status !== 'PENDING_CONFIRMATION') {
      throw new BridgeValidationError('Transfer is not awaiting confirmation');
    }
    const started = Date.now();
    const executed = await this.registry.executeTransfer(transfer.providerQuoteId);
    const updated = await this.prisma.bridgeTransfer.update({
      where: { id: transfer.id },
      data: {
        status: executed.status === 'FAILED' ? 'FAILED' : 'BRIDGING',
        providerRef: executed.providerRef,
        sourceTxHash: executed.sourceTxHash,
        confirmedAt: this.clock.now(),
        executedAt: this.clock.now(),
        errorMessage: executed.errorMessage,
      },
    });
    await this.prisma.bridgeReceipt.create({
      data: {
        id: this.ids.uuid(),
        transferId: transfer.id,
        userId,
        providerCode: transfer.providerCode,
        sourceNetwork: transfer.sourceNetwork,
        destinationNetwork: transfer.destinationNetwork,
        assetSymbol: transfer.assetSymbol,
        amountIn: transfer.amountIn,
        amountOut: transfer.amountOutExpected,
        sourceTxHash: executed.sourceTxHash,
        status: updated.status,
        payloadEncrypted: this.crypto.encrypt(
          JSON.stringify({
            providerRef: executed.providerRef,
            replayNonce: transfer.replayNonce,
          }),
        ),
      },
    });
    if (executed.status === 'FAILED') {
      await this.enqueueRetry(transfer.id, 'EXECUTE_RETRY', executed.errorMessage);
      void this.analytics.publishEvent({
        eventType: BRIDGE_EVENTS.FAILED,
        aggregateId: transfer.id,
        payload: { userId, latencyMs: Date.now() - started },
      });
      return { transferId, status: 'FAILED', errorMessage: executed.errorMessage };
    }
    void this.notifications.publishEvent({
      eventType: BRIDGE_EVENTS.EXECUTED,
      aggregateId: transfer.id,
      payload: {
        userId,
        title: 'Bridge submitted',
        body: `${transfer.assetSymbol} ${transfer.sourceNetwork} → ${transfer.destinationNetwork}`,
      },
    });
    void this.analytics.publishEvent({
      eventType: BRIDGE_EVENTS.EXECUTED,
      aggregateId: transfer.id,
      payload: { userId, latencyMs: Date.now() - started, providerCode: transfer.providerCode },
    });
    void this.ai.publish(BRIDGE_EVENTS.EXECUTED, { userId, transferId });
    return {
      transferId,
      status: updated.status,
      providerRef: executed.providerRef,
      sourceTxHash: executed.sourceTxHash,
    };
  }

  async syncStatus(userId: string, transferId: string) {
    const transfer = await this.prisma.bridgeTransfer.findFirst({
      where: { id: transferId, userId },
    });
    if (!transfer?.providerRef) throw new BridgeNotFoundError();
    const status = await this.registry.getExecutionStatus(transfer.providerRef);
    const updated = await this.prisma.bridgeTransfer.update({
      where: { id: transfer.id },
      data: {
        status:
          status.status === 'COMPLETED'
            ? 'COMPLETED'
            : status.status === 'FAILED'
              ? 'FAILED'
              : 'BRIDGING',
        destinationTxHash: status.destinationTxHash,
        amountOutActual: status.amountOutActual,
        errorMessage: status.errorMessage,
        completedAt: status.status === 'COMPLETED' ? this.clock.now() : undefined,
      },
    });
    if (status.status === 'COMPLETED') {
      void this.notifications.publishEvent({
        eventType: BRIDGE_EVENTS.COMPLETED,
        aggregateId: transfer.id,
        payload: { userId, title: 'Bridge completed', body: transfer.routeSummary },
      });
      void this.analytics.publishEvent({
        eventType: BRIDGE_EVENTS.COMPLETED,
        aggregateId: transfer.id,
        payload: { userId, providerCode: transfer.providerCode },
      });
    }
    return updated;
  }

  async history(userId: string) {
    return this.prisma.bridgeTransfer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { receipt: true },
    });
  }

  async getTransfer(userId: string, transferId: string) {
    const transfer = await this.prisma.bridgeTransfer.findFirst({
      where: { id: transferId, userId },
      include: { receipt: true, quote: true },
    });
    if (!transfer) throw new BridgeNotFoundError();
    return transfer;
  }

  private validateRouteBasics(request: BridgeQuoteRequest) {
    if (isSameNetworkRoute(request.sourceNetwork, request.destinationNetwork)) {
      throw new BridgeValidationError('source and destination networks must differ');
    }
    if (!request.amount || Number(request.amount) <= 0) {
      throw new BridgeValidationError('amount must be positive');
    }
    if (!request.assetSymbol?.trim()) {
      throw new BridgeValidationError('assetSymbol required');
    }
  }

  private async enqueueRetry(transferId: string, jobType: string, errorMessage?: string) {
    await this.prisma.bridgeRetryJob.create({
      data: {
        id: this.ids.uuid(),
        transferId,
        jobType,
        status: 'PENDING',
        payload: { transferId } as Prisma.InputJsonValue,
        errorMessage,
      },
    });
  }
}
