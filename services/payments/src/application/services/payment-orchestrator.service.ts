import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Prisma, PaymentStatus, PaymentType } from '@auvora/database';
import type { JwtAccessClaims, PermissionCode } from '@auvora/types';
import {
  PAYMENT_REPOSITORY,
  type CreatePaymentData,
  type PaymentFilters,
  type PaymentRecord,
  type PaymentRepositoryPort,
} from '../ports/payment-repository.port';
import { REFUND_REPOSITORY, type RefundRepositoryPort } from '../ports/refund-repository.port';
import { PROVIDER_RESOLVER, type ProviderResolverPort } from '../ports/provider-factory.port';
import { WALLET_LEDGER, type WalletLedgerPort } from '../ports/wallet-ledger.port';
import { ID_GENERATOR, type IdGeneratorPort } from '../ports/clock.port';
import { AI_PUBLISHER, type AiPublisherPort } from '../../infrastructure/ai/ai-publisher.adapter';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
import { LimitsService } from './limits.service';
import {
  assertTransition,
  ConflictError,
  EVENT_BUS,
  type EventBusPort,
  ForbiddenError,
  FRAUD_HOOK,
  type FraudHookPort,
  NotFoundError,
  PaymentEventType,
  PERMISSION_PAYMENT_ADMIN,
  ValidationError,
} from '../../domain';

const WALLET_ROUTED_TYPES = new Set<PaymentType>([
  PaymentType.INTERNAL_TRANSFER,
  PaymentType.WALLET_TRANSFER,
]);

const REFUNDABLE_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.SETTLED,
  PaymentStatus.COMPLETED,
]);
const CANCELLABLE_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.CREATED,
  PaymentStatus.PENDING,
  PaymentStatus.AUTHORIZED,
]);

export interface CreatePaymentInput {
  ownerUserId: string;
  type: PaymentType;
  amount: string;
  currency: string;
  assetCode?: string;
  fromWalletId?: string;
  toWalletId?: string;
  paymentMethodId?: string;
  idempotencyKey?: string;
  correlationId?: string;
  country?: string;
  accountTier?: string;
  riskProfile?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateTransferInput {
  ownerUserId: string;
  fromWalletId: string;
  toWalletId: string;
  amount: string;
  currency: string;
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePaymentRequestInput {
  ownerUserId: string;
  amount: string;
  currency: string;
  toWalletId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundPaymentInput {
  amount?: string;
  reason?: string;
}

export interface PaymentStatistics {
  totalPayments: number;
  totalCompleted: number;
  totalFailed: number;
  totalPending: number;
  totalVolume: string;
}

@Injectable()
export class PaymentOrchestratorService {
  private readonly logger = new Logger(PaymentOrchestratorService.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepositoryPort,
    @Inject(REFUND_REPOSITORY) private readonly refunds: RefundRepositoryPort,
    @Inject(PROVIDER_RESOLVER) private readonly providerResolver: ProviderResolverPort,
    @Inject(WALLET_LEDGER) private readonly walletLedger: WalletLedgerPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(FRAUD_HOOK) private readonly fraudHook: FraudHookPort,
    @Inject(LimitsService) private readonly limitsService: LimitsService,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(AI_PUBLISHER) private readonly ai: AiPublisherPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
  ) {}

  private async notifyPaymentCompleted(payment: PaymentRecord): Promise<void> {
    await this.notifications.publishEvent({
      eventType: 'payment.completed',
      aggregateId: payment.id,
      correlationId: payment.correlationId ?? undefined,
      payload: {
        reference: payment.reference,
        ownerUserId: payment.ownerUserId,
        amount: payment.amount,
        currency: payment.currency,
      },
    });
    await this.ai.publishEvent({
      eventType: 'payment.completed',
      aggregateId: payment.id,
      correlationId: payment.correlationId ?? undefined,
      payload: {
        reference: payment.reference,
        ownerUserId: payment.ownerUserId,
        amount: payment.amount,
        currency: payment.currency,
      },
    });
    await this.analytics.publishEvent({
      eventType: 'payment.completed',
      domain: 'PAYMENTS',
      aggregateId: payment.id,
      correlationId: payment.correlationId ?? undefined,
      ownerUserId: payment.ownerUserId ?? undefined,
      metrics: { tx_volume: 1 },
      payload: {
        reference: payment.reference,
        ownerUserId: payment.ownerUserId,
        amount: payment.amount,
        currency: payment.currency,
      },
    });
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    if (input.idempotencyKey) {
      const existing = await this.payments.findByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    if (Number(input.amount) <= 0) {
      throw new ValidationError('Payment amount must be greater than zero');
    }

    const fraudResult = await this.fraudHook.checkPayment({
      paymentId: 'pending',
      ownerUserId: input.ownerUserId,
      paymentType: input.type,
      amount: input.amount,
      currency: input.currency,
      metadata: input.metadata,
    });
    if (!fraudResult.allow) {
      throw new ForbiddenError(
        `Payment blocked by fraud screening: ${fraudResult.reasons?.join(', ') ?? 'risk threshold exceeded'}`,
      );
    }

    await this.limitsService.evaluate({
      ownerUserId: input.ownerUserId,
      amount: input.amount,
      currency: input.currency,
      // Server-derived default tier — ignore client-supplied escalation.
      accountTier: 'standard',
      country: input.country,
      riskProfile: undefined,
    });

    const created = await this.payments.create(this.toCreateData(input));

    await this.eventBus.publish({
      type: PaymentEventType.PaymentCreated,
      aggregateId: created.id,
      correlationId: created.correlationId ?? undefined,
      payload: {
        reference: created.reference,
        type: created.type,
        amount: created.amount,
        currency: created.currency,
      },
    });

    return this.route(created);
  }

  async createTransfer(input: CreateTransferInput): Promise<PaymentRecord> {
    return this.createPayment({
      ownerUserId: input.ownerUserId,
      type: PaymentType.WALLET_TRANSFER,
      amount: input.amount,
      currency: input.currency,
      fromWalletId: input.fromWalletId,
      toWalletId: input.toWalletId,
      idempotencyKey: input.idempotencyKey,
      description: input.description,
      metadata: input.metadata,
    });
  }

  /** A payment request is an unfunded invoice: it is created but not routed until fulfilled. */
  async createPaymentRequest(input: CreatePaymentRequestInput): Promise<PaymentRecord> {
    if (Number(input.amount) <= 0) {
      throw new ValidationError('Payment request amount must be greater than zero');
    }
    return this.payments.create({
      reference: this.generateReference(),
      type: PaymentType.PAYMENT_REQUEST,
      ownerUserId: input.ownerUserId,
      amount: input.amount,
      currency: input.currency,
      toWalletId: input.toWalletId,
      description: input.description,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    });
  }

  async get(id: string, requester: JwtAccessClaims): Promise<PaymentRecord> {
    const payment = await this.requirePayment(id);
    this.assertOwnershipOrAdmin(payment, requester);
    return payment;
  }

  async search(
    filters: PaymentFilters,
    requester: JwtAccessClaims,
  ): Promise<{ items: PaymentRecord[]; total: number }> {
    if (!this.hasAdminPermission(requester)) {
      return this.payments.list({ ...filters, ownerUserId: requester.sub });
    }
    return this.payments.list(filters);
  }

  async adminSearch(filters: PaymentFilters): Promise<{ items: PaymentRecord[]; total: number }> {
    return this.payments.list(filters);
  }

  async cancel(id: string, requester: JwtAccessClaims): Promise<PaymentRecord> {
    const payment = await this.requirePayment(id);
    this.assertOwnershipOrAdmin(payment, requester);

    if (!CANCELLABLE_STATUSES.has(payment.status)) {
      throw new ConflictError(`Payment in status ${payment.status} cannot be cancelled`);
    }
    assertTransition(payment.status, PaymentStatus.CANCELLED);

    const updated = await this.payments.update(id, {
      status: PaymentStatus.CANCELLED,
      cancelledAt: new Date(),
    });

    await this.eventBus.publish({
      type: PaymentEventType.PaymentCancelled,
      aggregateId: updated.id,
      payload: { reference: updated.reference },
    });

    return updated;
  }

  async refund(
    id: string,
    input: RefundPaymentInput,
    requester: JwtAccessClaims,
  ): Promise<PaymentRecord> {
    const payment = await this.requirePayment(id);
    this.assertOwnershipOrAdmin(payment, requester);

    if (!REFUNDABLE_STATUSES.has(payment.status)) {
      throw new ConflictError(`Payment in status ${payment.status} cannot be refunded`);
    }

    const refundAmount = input.amount ?? payment.amount;
    if (Number(refundAmount) > Number(payment.amount)) {
      throw new ValidationError('Refund amount cannot exceed the original payment amount');
    }

    const refund = await this.refunds.create({
      paymentId: payment.id,
      amount: refundAmount,
      currency: payment.currency,
      reason: input.reason,
      status: PaymentStatus.PROCESSING,
    });

    try {
      if (WALLET_ROUTED_TYPES.has(payment.type) && payment.fromWalletId && payment.toWalletId) {
        // Reverse transfer debits the original destination wallet — assert that wallet's owner.
        const counterparty = await this.walletLedger.getWalletOwner(payment.toWalletId);
        if (!counterparty) {
          throw new ConflictError('Refund counterparty wallet not found');
        }
        const result = await this.walletLedger.transfer({
          fromWalletId: payment.toWalletId,
          toWalletId: payment.fromWalletId,
          amount: refundAmount,
          expectedOwnerUserId: counterparty.ownerUserId,
          description: `Refund for payment ${payment.reference}`,
        });
        if (!result.success) {
          throw new ConflictError(result.message ?? 'Refund wallet transfer failed');
        }
      } else if (payment.providerRef) {
        const provider = await this.providerResolver.resolve(payment.type);
        await provider.refund({
          paymentId: payment.id,
          providerRef: payment.providerRef,
          amount: refundAmount,
          currency: payment.currency,
          reason: input.reason,
          idempotencyKey: `refund:${refund.id}`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'refund failed';
      await this.refunds.update(refund.id, { status: PaymentStatus.FAILED });
      throw new ConflictError(`Refund could not be processed: ${message}`);
    }

    await this.refunds.update(refund.id, {
      status: PaymentStatus.COMPLETED,
      completedAt: new Date(),
    });

    assertTransition(payment.status, PaymentStatus.REFUNDED);
    const updated = await this.payments.update(id, { status: PaymentStatus.REFUNDED });

    await this.eventBus.publish({
      type: PaymentEventType.PaymentRefunded,
      aggregateId: updated.id,
      payload: { reference: updated.reference, amount: refundAmount },
    });

    return updated;
  }

  async getReceipt(id: string, requester: JwtAccessClaims): Promise<Record<string, unknown>> {
    const payment = await this.get(id, requester);
    return {
      reference: payment.reference,
      type: payment.type,
      status: payment.status,
      amount: payment.amount,
      feeAmount: payment.feeAmount,
      currency: payment.currency,
      createdAt: payment.createdAt,
      completedAt: payment.completedAt,
      providerRef: payment.providerRef,
    };
  }

  async getStatistics(ownerUserId: string): Promise<PaymentStatistics> {
    const [
      { total: totalPayments },
      { total: totalCompleted },
      { total: totalFailed },
      { total: totalPending },
    ] = await Promise.all([
      this.payments.list({ ownerUserId, take: 1 }),
      this.payments.list({ ownerUserId, status: PaymentStatus.COMPLETED, take: 1 }),
      this.payments.list({ ownerUserId, status: PaymentStatus.FAILED, take: 1 }),
      this.payments.list({ ownerUserId, status: PaymentStatus.PENDING, take: 1 }),
    ]);
    const { total: totalVolume } = await this.payments.sumAmountSince(ownerUserId, new Date(0));

    return { totalPayments, totalCompleted, totalFailed, totalPending, totalVolume };
  }

  /** Drives a freshly created payment through authorization/capture (or wallet transfer) to a terminal or in-flight state. */
  private async route(payment: PaymentRecord): Promise<PaymentRecord> {
    assertTransition(payment.status, PaymentStatus.PENDING);
    let current = await this.payments.update(payment.id, { status: PaymentStatus.PENDING });

    try {
      if (WALLET_ROUTED_TYPES.has(current.type)) {
        current = await this.routeWalletTransfer(current);
      } else {
        current = await this.routeViaProvider(current);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'payment processing failed';
      this.logger.warn(`Payment ${current.reference} failed to route: ${message}`);
      if (!current.status || current.status === PaymentStatus.FAILED) {
        return current;
      }
      assertTransition(current.status, PaymentStatus.FAILED);
      current = await this.payments.update(current.id, {
        status: PaymentStatus.FAILED,
        failureReason: message,
      });
      await this.eventBus.publish({
        type: PaymentEventType.PaymentFailed,
        aggregateId: current.id,
        payload: { reference: current.reference, reason: message },
      });
    }

    return current;
  }

  private async routeWalletTransfer(payment: PaymentRecord): Promise<PaymentRecord> {
    if (!payment.fromWalletId || !payment.toWalletId) {
      throw new ValidationError('Wallet transfers require both fromWalletId and toWalletId');
    }

    const result = await this.walletLedger.transfer({
      fromWalletId: payment.fromWalletId,
      toWalletId: payment.toWalletId,
      amount: payment.amount,
      expectedOwnerUserId: payment.ownerUserId,
      description: payment.description ?? `Payment ${payment.reference}`,
    });
    if (!result.success) {
      throw new ConflictError(result.message ?? 'Wallet transfer failed');
    }

    assertTransition(payment.status, PaymentStatus.AUTHORIZED);
    let current = await this.payments.update(payment.id, {
      status: PaymentStatus.AUTHORIZED,
      authorizedAt: new Date(),
      walletTransactionId: result.transactionId ?? null,
    });
    await this.eventBus.publish({
      type: PaymentEventType.PaymentAuthorized,
      aggregateId: current.id,
      payload: { reference: current.reference },
    });

    assertTransition(current.status, PaymentStatus.PROCESSING);
    current = await this.payments.update(current.id, { status: PaymentStatus.PROCESSING });
    await this.eventBus.publish({
      type: PaymentEventType.PaymentProcessing,
      aggregateId: current.id,
      payload: { reference: current.reference },
    });

    assertTransition(current.status, PaymentStatus.COMPLETED);
    current = await this.payments.update(current.id, {
      status: PaymentStatus.COMPLETED,
      completedAt: new Date(),
    });
    await this.eventBus.publish({
      type: PaymentEventType.PaymentCompleted,
      aggregateId: current.id,
      payload: { reference: current.reference },
    });
    await this.notifyPaymentCompleted(current);

    return current;
  }

  private async routeViaProvider(payment: PaymentRecord): Promise<PaymentRecord> {
    const provider = await this.providerResolver.resolve(payment.type);

    const authResult = await provider.authorize({
      paymentId: payment.id,
      paymentType: payment.type,
      amount: payment.amount,
      currency: payment.currency,
      idempotencyKey: payment.idempotencyKey ?? `auth:${payment.id}`,
      ownerUserId: payment.ownerUserId,
      fromWalletId: payment.fromWalletId ?? undefined,
      toWalletId: payment.toWalletId ?? undefined,
    });

    if (authResult.status === 'FAILED') {
      throw new ConflictError(authResult.message ?? 'Provider declined authorization');
    }

    assertTransition(payment.status, PaymentStatus.AUTHORIZED);
    let current = await this.payments.update(payment.id, {
      status: PaymentStatus.AUTHORIZED,
      providerRef: authResult.providerRef,
      authorizedAt: new Date(),
    });
    await this.eventBus.publish({
      type: PaymentEventType.PaymentAuthorized,
      aggregateId: current.id,
      payload: { reference: current.reference, providerRef: authResult.providerRef },
    });

    assertTransition(current.status, PaymentStatus.PROCESSING);
    current = await this.payments.update(current.id, { status: PaymentStatus.PROCESSING });
    await this.eventBus.publish({
      type: PaymentEventType.PaymentProcessing,
      aggregateId: current.id,
      payload: { reference: current.reference },
    });

    const captureResult = await provider.capture({
      paymentId: current.id,
      providerRef: authResult.providerRef,
      amount: current.amount,
      currency: current.currency,
      idempotencyKey: current.idempotencyKey ?? `capture:${current.id}`,
    });

    if (captureResult.status === 'FAILED') {
      throw new ConflictError(captureResult.message ?? 'Provider declined capture');
    }

    await this.settleWalletSideEffects(current);

    assertTransition(current.status, PaymentStatus.COMPLETED);
    current = await this.payments.update(current.id, {
      status: PaymentStatus.COMPLETED,
      completedAt: new Date(),
    });
    await this.eventBus.publish({
      type: PaymentEventType.PaymentCompleted,
      aggregateId: current.id,
      payload: { reference: current.reference },
    });
    await this.notifyPaymentCompleted(current);

    return current;
  }

  /**
   * Wallet credit/debit for fiat deposits & withdrawals.
   * Fail-closed: payment must not COMPLETE if ledger mutation fails
   * (especially withdrawals — otherwise funds leave without a debit).
   */
  private async settleWalletSideEffects(payment: PaymentRecord): Promise<void> {
    if (payment.type === PaymentType.FIAT_DEPOSIT && payment.toWalletId) {
      const result = await this.walletLedger.credit({
        walletId: payment.toWalletId,
        amount: payment.amount,
        expectedOwnerUserId: payment.ownerUserId,
        description: `Deposit settlement ${payment.reference}`,
        transactionType: 'DEPOSIT',
      });
      if (!result.success) {
        throw new ConflictError(result.message ?? 'Deposit wallet credit failed');
      }
      return;
    }

    if (payment.type === PaymentType.FIAT_WITHDRAWAL && payment.fromWalletId) {
      const result = await this.walletLedger.debit({
        walletId: payment.fromWalletId,
        amount: payment.amount,
        expectedOwnerUserId: payment.ownerUserId,
        description: `Withdrawal settlement ${payment.reference}`,
        transactionType: 'WITHDRAWAL',
      });
      if (!result.success) {
        throw new ConflictError(result.message ?? 'Withdrawal wallet debit failed');
      }
    }
  }

  private toCreateData(input: CreatePaymentInput): CreatePaymentData {
    return {
      reference: this.generateReference(),
      type: input.type,
      ownerUserId: input.ownerUserId,
      amount: input.amount,
      currency: input.currency,
      assetCode: input.assetCode,
      fromWalletId: input.fromWalletId,
      toWalletId: input.toWalletId,
      paymentMethodId: input.paymentMethodId,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      country: input.country,
      // Tier/risk are server-derived only — never persist client-supplied values.
      accountTier: 'standard',
      riskProfile: undefined,
      description: input.description,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    };
  }

  private generateReference(): string {
    return `PAY-${this.ids.uuid()}`;
  }

  private async requirePayment(id: string): Promise<PaymentRecord> {
    const payment = await this.payments.findById(id);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }
    return payment;
  }

  private assertOwnershipOrAdmin(payment: PaymentRecord, requester: JwtAccessClaims): void {
    if (payment.ownerUserId !== requester.sub && !this.hasAdminPermission(requester)) {
      throw new ForbiddenError('Access denied');
    }
  }

  private hasAdminPermission(requester: JwtAccessClaims): boolean {
    return requester.permissions.includes(PERMISSION_PAYMENT_ADMIN as PermissionCode);
  }
}
