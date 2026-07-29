import { Inject, Injectable } from '@nestjs/common';
import { ChargebackStatus, DisputeStatus, PaymentStatus } from '@auvora/database';
import { PAYMENT_REPOSITORY, type PaymentRepositoryPort } from '../ports/payment-repository.port';
import {
  PROVIDER_RECORD_REPOSITORY,
  type ProviderRecord,
  type ProviderRecordRepositoryPort,
} from '../ports/provider-record-repository.port';
import {
  PROVIDER_HEALTH_REPOSITORY,
  type ProviderHealthFilters,
  type ProviderHealthRecord,
  type ProviderHealthRepositoryPort,
} from '../ports/provider-health-repository.port';
import {
  DISPUTE_REPOSITORY,
  type DisputeFilters,
  type DisputeRecord,
  type DisputeRepositoryPort,
} from '../ports/dispute-repository.port';
import {
  CHARGEBACK_REPOSITORY,
  type ChargebackFilters,
  type ChargebackRecord,
  type ChargebackRepositoryPort,
} from '../ports/chargeback-repository.port';
import {
  LIMIT_REPOSITORY,
  type CreatePaymentLimitData,
  type LimitRepositoryPort,
  type PaymentLimitFilters,
  type PaymentLimitRecord,
  type UpdatePaymentLimitData,
} from '../ports/limit-repository.port';
import {
  RECONCILIATION_REPOSITORY,
  type ReconciliationFilters,
  type ReconciliationRecord,
  type ReconciliationRepositoryPort,
} from '../ports/reconciliation-repository.port';
import {
  REFUND_REPOSITORY,
  type RefundFilters,
  type RefundRecord,
  type RefundRepositoryPort,
} from '../ports/refund-repository.port';
import {
  SETTLEMENT_BATCH_REPOSITORY,
  SETTLEMENT_REPOSITORY,
  type SettlementBatchFilters,
  type SettlementBatchRecord,
  type SettlementBatchRepositoryPort,
  type SettlementFilters,
  type SettlementRecord,
  type SettlementRepositoryPort,
} from '../ports/settlement-repository.port';
import { NotFoundError } from '../../domain';

export interface AdminMetrics {
  totalPayments: number;
  pendingPayments: number;
  processingPayments: number;
  completedPayments: number;
  failedPayments: number;
  disputedPayments: number;
  openDisputes: number;
  openChargebacks: number;
  pendingReconciliation: number;
}

/**
 * Read/write aggregation service backing the admin dashboard: metrics,
 * provider health, disputes/chargebacks, limits CRUD, and the recon queue.
 */
@Injectable()
export class AdminPaymentsService {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepositoryPort,
    @Inject(PROVIDER_RECORD_REPOSITORY) private readonly providers: ProviderRecordRepositoryPort,
    @Inject(PROVIDER_HEALTH_REPOSITORY)
    private readonly providerHealth: ProviderHealthRepositoryPort,
    @Inject(REFUND_REPOSITORY) private readonly refunds: RefundRepositoryPort,
    @Inject(DISPUTE_REPOSITORY) private readonly disputes: DisputeRepositoryPort,
    @Inject(CHARGEBACK_REPOSITORY) private readonly chargebacks: ChargebackRepositoryPort,
    @Inject(LIMIT_REPOSITORY) private readonly limits: LimitRepositoryPort,
    @Inject(RECONCILIATION_REPOSITORY)
    private readonly reconciliations: ReconciliationRepositoryPort,
    @Inject(SETTLEMENT_REPOSITORY) private readonly settlements: SettlementRepositoryPort,
    @Inject(SETTLEMENT_BATCH_REPOSITORY)
    private readonly settlementBatches: SettlementBatchRepositoryPort,
  ) {}

  async getMetrics(): Promise<AdminMetrics> {
    const [
      { total: totalPayments },
      { total: pendingPayments },
      { total: processingPayments },
      { total: completedPayments },
      { total: failedPayments },
      { total: disputedPayments },
      { total: openDisputes },
      { total: openChargebacks },
      { total: pendingReconciliation },
    ] = await Promise.all([
      this.payments.list({ take: 1 }),
      this.payments.list({ status: PaymentStatus.PENDING, take: 1 }),
      this.payments.list({ status: PaymentStatus.PROCESSING, take: 1 }),
      this.payments.list({ status: PaymentStatus.COMPLETED, take: 1 }),
      this.payments.list({ status: PaymentStatus.FAILED, take: 1 }),
      this.payments.list({ status: PaymentStatus.DISPUTED, take: 1 }),
      this.disputes.list({ status: DisputeStatus.OPEN, take: 1 }),
      this.chargebacks.list({ status: ChargebackStatus.OPEN, take: 1 }),
      this.reconciliations.list({ requiresManualReview: true, take: 1 }),
    ]);

    return {
      totalPayments,
      pendingPayments,
      processingPayments,
      completedPayments,
      failedPayments,
      disputedPayments,
      openDisputes,
      openChargebacks,
      pendingReconciliation,
    };
  }

  listProviders(): Promise<ProviderRecord[]> {
    return this.providers.listAll();
  }

  listHealth(
    filters: ProviderHealthFilters,
  ): Promise<{ items: ProviderHealthRecord[]; total: number }> {
    return this.providerHealth.list(filters);
  }

  searchPayments(filters: Parameters<PaymentRepositoryPort['list']>[0]) {
    return this.payments.list(filters);
  }

  listRefunds(filters: RefundFilters): Promise<{ items: RefundRecord[]; total: number }> {
    return this.refunds.list(filters);
  }

  listDisputes(filters: DisputeFilters): Promise<{ items: DisputeRecord[]; total: number }> {
    return this.disputes.list(filters);
  }

  listChargebacks(
    filters: ChargebackFilters,
  ): Promise<{ items: ChargebackRecord[]; total: number }> {
    return this.chargebacks.list(filters);
  }

  listReconciliation(
    filters: ReconciliationFilters,
  ): Promise<{ items: ReconciliationRecord[]; total: number }> {
    return this.reconciliations.list(filters);
  }

  listSettlements(
    filters: SettlementFilters,
  ): Promise<{ items: SettlementRecord[]; total: number }> {
    return this.settlements.list(filters);
  }

  listSettlementBatches(
    filters: SettlementBatchFilters,
  ): Promise<{ items: SettlementBatchRecord[]; total: number }> {
    return this.settlementBatches.list(filters);
  }

  getSettlementReports(
    filters: SettlementBatchFilters,
  ): Promise<{ items: SettlementBatchRecord[]; total: number }> {
    return this.settlementBatches.list(filters);
  }

  listLimits(
    filters: PaymentLimitFilters,
  ): Promise<{ items: PaymentLimitRecord[]; total: number }> {
    return this.limits.list(filters);
  }

  createLimit(data: CreatePaymentLimitData): Promise<PaymentLimitRecord> {
    return this.limits.create(data);
  }

  async updateLimit(id: string, data: UpdatePaymentLimitData): Promise<PaymentLimitRecord> {
    const existing = await this.limits.findById(id);
    if (!existing) {
      throw new NotFoundError('Payment limit not found');
    }
    return this.limits.update(id, data);
  }

  async flagRisk(paymentId: string, riskFlags: string[]) {
    const payment = await this.payments.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }
    return this.payments.update(paymentId, { riskFlags });
  }
}
