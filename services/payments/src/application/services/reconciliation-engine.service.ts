import { Inject, Injectable } from '@nestjs/common';
import { PaymentStatus, ReconciliationStatus } from '@auvora/database';
import {
  PAYMENT_REPOSITORY,
  type PaymentRecord,
  type PaymentRepositoryPort,
} from '../ports/payment-repository.port';
import {
  RECONCILIATION_REPOSITORY,
  type ReconciliationRecord,
  type ReconciliationRepositoryPort,
} from '../ports/reconciliation-repository.port';
import { PROVIDER_RESOLVER, type ProviderResolverPort } from '../ports/provider-factory.port';
import { EVENT_BUS, type EventBusPort, NotFoundError, PaymentEventType } from '../../domain';

/**
 * Compares recorded payment amounts against the provider's (or settlement's)
 * reported amount and flags mismatches for manual review.
 */
@Injectable()
export class ReconciliationEngineService {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepositoryPort,
    @Inject(RECONCILIATION_REPOSITORY)
    private readonly reconciliations: ReconciliationRepositoryPort,
    @Inject(PROVIDER_RESOLVER) private readonly providerResolver: ProviderResolverPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
  ) {}

  async reconcilePayment(paymentId: string): Promise<ReconciliationRecord> {
    const payment = await this.requirePayment(paymentId);

    let actualAmount = payment.amount;
    let source = 'internal';

    if (payment.providerRef) {
      try {
        const provider = await this.providerResolver.resolve(payment.type);
        source = provider.getCode();
        const status = await provider.getStatus(payment.providerRef);
        const reportedAmount = status.metadata?.['amount'];
        if (typeof reportedAmount === 'string' || typeof reportedAmount === 'number') {
          actualAmount = String(reportedAmount);
        }
      } catch (error) {
        return this.recordException(
          payment,
          error instanceof Error ? error.message : 'provider status lookup failed',
        );
      }
    }

    const expected = Number(payment.amount);
    const actual = Number(actualAmount);
    const matches = Math.abs(expected - actual) < 1e-8;

    const record = await this.reconciliations.create({
      paymentId: payment.id,
      status: matches ? ReconciliationStatus.MATCHED : ReconciliationStatus.MISMATCH,
      source,
      expectedAmount: payment.amount,
      actualAmount,
      currency: payment.currency,
      mismatchReason: matches ? undefined : `Expected ${expected} but ${source} reports ${actual}`,
      requiresManualReview: !matches,
    });

    if (!matches) {
      await this.eventBus.publish({
        type: PaymentEventType.ReconciliationMismatch,
        aggregateId: payment.id,
        payload: { paymentId: payment.id, expected, actual },
      });
    }

    return record;
  }

  async resolve(id: string, resolvedBy: string): Promise<ReconciliationRecord> {
    const updated = await this.reconciliations.update(id, {
      status: ReconciliationStatus.RESOLVED,
      resolvedAt: new Date(),
      resolvedBy,
      requiresManualReview: false,
    });
    await this.eventBus.publish({
      type: PaymentEventType.ReconciliationResolved,
      aggregateId: updated.paymentId ?? updated.id,
      payload: { reconciliationId: updated.id },
    });
    return updated;
  }

  /** Scheduled/manual job: reconciles every payment currently in SETTLED status. */
  async runAutoReconciliation(): Promise<{ processed: number; mismatches: number }> {
    const { items } = await this.payments.list({ status: PaymentStatus.SETTLED, take: 200 });
    let mismatches = 0;
    for (const payment of items) {
      const record = await this.reconcilePayment(payment.id);
      if (record.status !== ReconciliationStatus.MATCHED) {
        mismatches += 1;
      }
    }
    return { processed: items.length, mismatches };
  }

  private async recordException(
    payment: PaymentRecord,
    reason: string,
  ): Promise<ReconciliationRecord> {
    const record = await this.reconciliations.create({
      paymentId: payment.id,
      status: ReconciliationStatus.EXCEPTION,
      source: 'provider',
      expectedAmount: payment.amount,
      currency: payment.currency,
      mismatchReason: reason,
      requiresManualReview: true,
    });
    await this.eventBus.publish({
      type: PaymentEventType.ReconciliationMismatch,
      aggregateId: payment.id,
      payload: { paymentId: payment.id, reason },
    });
    return record;
  }

  private async requirePayment(id: string): Promise<PaymentRecord> {
    const payment = await this.payments.findById(id);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }
    return payment;
  }
}
