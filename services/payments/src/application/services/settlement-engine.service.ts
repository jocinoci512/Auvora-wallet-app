import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PaymentStatus, SettlementMode, SettlementStatus } from '@auvora/database';
import {
  PAYMENT_REPOSITORY,
  type PaymentRecord,
  type PaymentRepositoryPort,
} from '../ports/payment-repository.port';
import {
  SETTLEMENT_BATCH_REPOSITORY,
  SETTLEMENT_REPOSITORY,
  type SettlementBatchRecord,
  type SettlementBatchRepositoryPort,
  type SettlementRecord,
  type SettlementRepositoryPort,
} from '../ports/settlement-repository.port';
import { ID_GENERATOR, type IdGeneratorPort } from '../ports/clock.port';
import {
  assertTransition,
  EVENT_BUS,
  type EventBusPort,
  NotFoundError,
  PaymentEventType,
} from '../../domain';
import { ENV, type ServiceEnv } from '../../config/env.schema';

@Injectable()
export class SettlementEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettlementEngineService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepositoryPort,
    @Inject(SETTLEMENT_REPOSITORY) private readonly settlements: SettlementRepositoryPort,
    @Inject(SETTLEMENT_BATCH_REPOSITORY) private readonly batches: SettlementBatchRepositoryPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(ENV) private readonly env: ServiceEnv,
  ) {}

  onModuleInit(): void {
    if (!this.env.PAYMENTS_SIMULATOR_ENABLED) {
      return;
    }
    this.timer = setInterval(() => {
      this.runScheduledBatch().catch((error: unknown) => {
        this.logger.error(
          `Scheduled settlement run failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, this.env.SETTLEMENT_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /** Settles a single payment immediately (used right after provider capture succeeds, or via API). */
  async runInstant(paymentId: string): Promise<SettlementRecord> {
    const payment = await this.requirePayment(paymentId);
    return this.settlePayment(payment, SettlementMode.INSTANT);
  }

  /** Settles an explicit set of payments as a manually triggered batch. */
  async runManualBatch(paymentIds: string[]): Promise<SettlementBatchRecord> {
    const payments = await Promise.all(paymentIds.map((id) => this.requirePayment(id)));
    return this.runBatch(payments, SettlementMode.MANUAL);
  }

  /** Sweeps all payments ready for settlement (used by the daily/scheduled cron-like interval). */
  async runScheduledBatch(): Promise<SettlementBatchRecord | null> {
    const payments = await this.payments.findSettlable('BATCH', 200);
    if (payments.length === 0) {
      return null;
    }
    return this.runBatch(payments, SettlementMode.DAILY);
  }

  async runDaily(): Promise<SettlementBatchRecord | null> {
    return this.runScheduledBatch();
  }

  private async runBatch(
    payments: PaymentRecord[],
    mode: SettlementMode,
  ): Promise<SettlementBatchRecord> {
    const currency = payments[0]?.currency ?? 'USD';
    let batch = await this.batches.create({
      reference: `BATCH-${this.ids.uuid()}`,
      mode,
      currency,
      paymentCount: payments.length,
    });

    await this.eventBus.publish({
      type: PaymentEventType.SettlementBatchCreated,
      aggregateId: batch.id,
      payload: { reference: batch.reference, mode, paymentCount: payments.length },
    });

    batch = await this.batches.update(batch.id, {
      status: SettlementStatus.PROCESSING,
      startedAt: new Date(),
    });

    let totalAmount = 0;
    let failed = false;
    for (const payment of payments) {
      try {
        const settlement = await this.settlePayment(payment, mode, batch.id);
        totalAmount += Number(settlement.amount);
      } catch (error) {
        failed = true;
        this.logger.warn(
          `Failed to settle payment ${payment.reference} in batch ${batch.reference}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const completed = await this.batches.update(batch.id, {
      status: failed ? SettlementStatus.FAILED : SettlementStatus.COMPLETED,
      totalAmount: totalAmount.toString(),
      completedAt: new Date(),
      failedAt: failed ? new Date() : undefined,
    });

    await this.eventBus.publish({
      type: failed
        ? PaymentEventType.SettlementBatchFailed
        : PaymentEventType.SettlementBatchCompleted,
      aggregateId: completed.id,
      payload: {
        reference: completed.reference,
        totalAmount: completed.totalAmount,
        paymentCount: payments.length,
      },
    });

    return completed;
  }

  private async settlePayment(
    payment: PaymentRecord,
    mode: SettlementMode,
    batchId?: string,
  ): Promise<SettlementRecord> {
    if (
      payment.status !== PaymentStatus.PROCESSING &&
      payment.status !== PaymentStatus.AUTHORIZED
    ) {
      throw new NotFoundError(
        `Payment ${payment.reference} is not eligible for settlement (status ${payment.status})`,
      );
    }

    let settlement = await this.settlements.create({
      batchId,
      paymentId: payment.id,
      mode,
      amount: payment.amount,
      currency: payment.currency,
      reference: `STL-${this.ids.uuid()}`,
    });

    settlement = await this.settlements.update(settlement.id, {
      status: SettlementStatus.PROCESSING,
      startedAt: new Date(),
    });

    let current = payment;
    if (current.status === PaymentStatus.AUTHORIZED) {
      assertTransition(current.status, PaymentStatus.PROCESSING);
      current = await this.payments.update(current.id, { status: PaymentStatus.PROCESSING });
    }

    assertTransition(current.status, PaymentStatus.SETTLED);
    current = await this.payments.update(current.id, {
      status: PaymentStatus.SETTLED,
      settledAt: new Date(),
    });

    settlement = await this.settlements.update(settlement.id, {
      status: SettlementStatus.COMPLETED,
      completedAt: new Date(),
    });

    await this.eventBus.publish({
      type: PaymentEventType.PaymentSettled,
      aggregateId: current.id,
      payload: { reference: current.reference, settlementReference: settlement.reference },
    });
    await this.eventBus.publish({
      type: PaymentEventType.SettlementCompleted,
      aggregateId: settlement.id,
      payload: { paymentId: current.id, amount: settlement.amount },
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

    return settlement;
  }

  private async requirePayment(id: string): Promise<PaymentRecord> {
    const payment = await this.payments.findById(id);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }
    return payment;
  }
}
