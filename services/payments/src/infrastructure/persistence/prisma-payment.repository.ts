import { Inject, Injectable } from '@nestjs/common';
import { type PaymentStatus, type PaymentType, Prisma, PrismaService } from '@auvora/database';
import type {
  CreatePaymentData,
  PaymentFilters,
  PaymentRecord,
  PaymentRepositoryPort,
  UpdatePaymentData,
} from '../../application/ports/payment-repository.port';

function mapPayment(record: {
  id: string;
  reference: string;
  type: PaymentType;
  status: PaymentStatus;
  ownerUserId: string;
  amount: Prisma.Decimal;
  feeAmount: Prisma.Decimal;
  currency: string;
  assetCode: string | null;
  fromWalletId: string | null;
  toWalletId: string | null;
  paymentMethodId: string | null;
  providerId: string | null;
  providerRef: string | null;
  idempotencyKey: string | null;
  correlationId: string | null;
  walletTransactionId: string | null;
  chainTxId: string | null;
  country: string | null;
  accountTier: string | null;
  riskProfile: string | null;
  riskFlags: string[];
  description: string | null;
  failureReason: string | null;
  scheduledAt: Date | null;
  authorizedAt: Date | null;
  settledAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  expiresAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): PaymentRecord {
  return {
    id: record.id,
    reference: record.reference,
    type: record.type,
    status: record.status,
    ownerUserId: record.ownerUserId,
    amount: record.amount.toString(),
    feeAmount: record.feeAmount.toString(),
    currency: record.currency,
    assetCode: record.assetCode,
    fromWalletId: record.fromWalletId,
    toWalletId: record.toWalletId,
    paymentMethodId: record.paymentMethodId,
    providerId: record.providerId,
    providerRef: record.providerRef,
    idempotencyKey: record.idempotencyKey,
    correlationId: record.correlationId,
    walletTransactionId: record.walletTransactionId,
    chainTxId: record.chainTxId,
    country: record.country,
    accountTier: record.accountTier,
    riskProfile: record.riskProfile,
    riskFlags: record.riskFlags,
    description: record.description,
    failureReason: record.failureReason,
    scheduledAt: record.scheduledAt,
    authorizedAt: record.authorizedAt,
    settledAt: record.settledAt,
    completedAt: record.completedAt,
    cancelledAt: record.cancelledAt,
    expiresAt: record.expiresAt,
    metadata: record.metadata as PaymentRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

const DEFAULT_EXCLUDED_STATUSES: PaymentStatus[] = ['CANCELLED', 'FAILED', 'EXPIRED'] as PaymentStatus[];

@Injectable()
export class PrismaPaymentRepository implements PaymentRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreatePaymentData): Promise<PaymentRecord> {
    const record = await this.prisma.payment.create({
      data: {
        reference: data.reference,
        type: data.type,
        status: data.status ?? 'CREATED',
        ownerUserId: data.ownerUserId,
        amount: new Prisma.Decimal(data.amount),
        feeAmount: new Prisma.Decimal(data.feeAmount ?? '0'),
        currency: data.currency,
        assetCode: data.assetCode ?? null,
        fromWalletId: data.fromWalletId ?? null,
        toWalletId: data.toWalletId ?? null,
        paymentMethodId: data.paymentMethodId ?? null,
        providerId: data.providerId ?? null,
        idempotencyKey: data.idempotencyKey ?? null,
        correlationId: data.correlationId ?? null,
        country: data.country ?? null,
        accountTier: data.accountTier ?? null,
        riskProfile: data.riskProfile ?? null,
        description: data.description ?? null,
        scheduledAt: data.scheduledAt ?? null,
        expiresAt: data.expiresAt ?? null,
        metadata: data.metadata,
      },
    });
    return mapPayment(record);
  }

  async findById(id: string): Promise<PaymentRecord | null> {
    const record = await this.prisma.payment.findUnique({ where: { id } });
    return record ? mapPayment(record) : null;
  }

  async findByReference(reference: string): Promise<PaymentRecord | null> {
    const record = await this.prisma.payment.findUnique({ where: { reference } });
    return record ? mapPayment(record) : null;
  }

  async findByIdempotencyKey(key: string): Promise<PaymentRecord | null> {
    const record = await this.prisma.payment.findUnique({ where: { idempotencyKey: key } });
    return record ? mapPayment(record) : null;
  }

  async list(filters: PaymentFilters): Promise<{ items: PaymentRecord[]; total: number }> {
    const where = {
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.statuses ? { status: { in: filters.statuses } } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.currency ? { currency: filters.currency } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items: items.map(mapPayment), total };
  }

  async update(id: string, data: UpdatePaymentData): Promise<PaymentRecord> {
    const record = await this.prisma.payment.update({
      where: { id },
      data: {
        status: data.status,
        providerId: data.providerId,
        providerRef: data.providerRef,
        walletTransactionId: data.walletTransactionId,
        chainTxId: data.chainTxId,
        failureReason: data.failureReason,
        riskFlags: data.riskFlags,
        feeAmount: data.feeAmount !== undefined ? new Prisma.Decimal(data.feeAmount) : undefined,
        authorizedAt: data.authorizedAt,
        settledAt: data.settledAt,
        completedAt: data.completedAt,
        cancelledAt: data.cancelledAt,
        metadata: data.metadata,
      },
    });
    return mapPayment(record);
  }

  async sumAmountSince(
    ownerUserId: string,
    since: Date,
    excludeStatuses: PaymentStatus[] = DEFAULT_EXCLUDED_STATUSES,
  ): Promise<{ count: number; total: string }> {
    const result = await this.prisma.payment.aggregate({
      where: {
        ownerUserId,
        createdAt: { gte: since },
        status: { notIn: excludeStatuses },
      },
      _sum: { amount: true },
      _count: true,
    });
    return { count: result._count, total: (result._sum.amount ?? new Prisma.Decimal(0)).toString() };
  }

  async findSettlable(_mode: 'INSTANT' | 'BATCH', take: number): Promise<PaymentRecord[]> {
    const records = await this.prisma.payment.findMany({
      where: { status: { in: ['PROCESSING', 'AUTHORIZED'] as PaymentStatus[] } },
      orderBy: { createdAt: 'asc' },
      take,
    });
    return records.map(mapPayment);
  }
}
