import { Inject, Injectable } from '@nestjs/common';
import { Prisma, PrismaService, type ReconciliationStatus } from '@auvora/database';
import type {
  CreateReconciliationData,
  ReconciliationFilters,
  ReconciliationRecord,
  ReconciliationRepositoryPort,
  UpdateReconciliationData,
} from '../../application/ports/reconciliation-repository.port';

function mapReconciliation(record: {
  id: string;
  paymentId: string | null;
  settlementId: string | null;
  status: ReconciliationStatus;
  source: string;
  expectedAmount: Prisma.Decimal | null;
  actualAmount: Prisma.Decimal | null;
  currency: string | null;
  mismatchReason: string | null;
  requiresManualReview: boolean;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ReconciliationRecord {
  return {
    id: record.id,
    paymentId: record.paymentId,
    settlementId: record.settlementId,
    status: record.status,
    source: record.source,
    expectedAmount: record.expectedAmount !== null ? record.expectedAmount.toString() : null,
    actualAmount: record.actualAmount !== null ? record.actualAmount.toString() : null,
    currency: record.currency,
    mismatchReason: record.mismatchReason,
    requiresManualReview: record.requiresManualReview,
    resolvedAt: record.resolvedAt,
    resolvedBy: record.resolvedBy,
    metadata: record.metadata as ReconciliationRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class PrismaReconciliationRepository implements ReconciliationRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateReconciliationData): Promise<ReconciliationRecord> {
    const record = await this.prisma.reconciliationRecord.create({
      data: {
        paymentId: data.paymentId ?? null,
        settlementId: data.settlementId ?? null,
        status: data.status ?? 'PENDING',
        source: data.source,
        expectedAmount: data.expectedAmount !== undefined && data.expectedAmount !== null
          ? new Prisma.Decimal(data.expectedAmount)
          : undefined,
        actualAmount: data.actualAmount !== undefined && data.actualAmount !== null
          ? new Prisma.Decimal(data.actualAmount)
          : undefined,
        currency: data.currency ?? null,
        mismatchReason: data.mismatchReason ?? null,
        requiresManualReview: data.requiresManualReview ?? false,
        metadata: data.metadata,
      },
    });
    return mapReconciliation(record);
  }

  async findById(id: string): Promise<ReconciliationRecord | null> {
    const record = await this.prisma.reconciliationRecord.findUnique({ where: { id } });
    return record ? mapReconciliation(record) : null;
  }

  async list(filters: ReconciliationFilters): Promise<{ items: ReconciliationRecord[]; total: number }> {
    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.requiresManualReview !== undefined ? { requiresManualReview: filters.requiresManualReview } : {}),
      ...(filters.paymentId ? { paymentId: filters.paymentId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.reconciliationRecord.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reconciliationRecord.count({ where }),
    ]);
    return { items: items.map(mapReconciliation), total };
  }

  async update(id: string, data: UpdateReconciliationData): Promise<ReconciliationRecord> {
    const record = await this.prisma.reconciliationRecord.update({
      where: { id },
      data: {
        status: data.status,
        mismatchReason: data.mismatchReason,
        requiresManualReview: data.requiresManualReview,
        resolvedAt: data.resolvedAt,
        resolvedBy: data.resolvedBy,
        metadata: data.metadata,
      },
    });
    return mapReconciliation(record);
  }
}
