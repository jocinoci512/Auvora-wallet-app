import { Inject, Injectable } from '@nestjs/common';
import {
  Prisma,
  PrismaService,
  type SettlementMode,
  type SettlementStatus,
} from '@auvora/database';
import type {
  CreateSettlementBatchData,
  CreateSettlementData,
  SettlementBatchFilters,
  SettlementBatchRecord,
  SettlementBatchRepositoryPort,
  SettlementFilters,
  SettlementRecord,
  SettlementRepositoryPort,
  UpdateSettlementBatchData,
  UpdateSettlementData,
} from '../../application/ports/settlement-repository.port';

function mapSettlement(record: {
  id: string;
  batchId: string | null;
  paymentId: string;
  mode: SettlementMode;
  status: SettlementStatus;
  amount: Prisma.Decimal;
  currency: string;
  reference: string;
  auditTrail: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SettlementRecord {
  return {
    id: record.id,
    batchId: record.batchId,
    paymentId: record.paymentId,
    mode: record.mode,
    status: record.status,
    amount: record.amount.toString(),
    currency: record.currency,
    reference: record.reference,
    auditTrail: record.auditTrail as SettlementRecord['auditTrail'],
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    failedAt: record.failedAt,
    failureReason: record.failureReason,
    metadata: record.metadata as SettlementRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapBatch(record: {
  id: string;
  reference: string;
  mode: SettlementMode;
  status: SettlementStatus;
  currency: string;
  totalAmount: Prisma.Decimal;
  paymentCount: number;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  report: unknown;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SettlementBatchRecord {
  return {
    id: record.id,
    reference: record.reference,
    mode: record.mode,
    status: record.status,
    currency: record.currency,
    totalAmount: record.totalAmount.toString(),
    paymentCount: record.paymentCount,
    scheduledAt: record.scheduledAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    failedAt: record.failedAt,
    failureReason: record.failureReason,
    report: record.report as SettlementBatchRecord['report'],
    metadata: record.metadata as SettlementBatchRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class PrismaSettlementRepository implements SettlementRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateSettlementData): Promise<SettlementRecord> {
    const record = await this.prisma.settlement.create({
      data: {
        batchId: data.batchId ?? null,
        paymentId: data.paymentId,
        mode: data.mode,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency,
        reference: data.reference,
        metadata: data.metadata,
      },
    });
    return mapSettlement(record);
  }

  async findById(id: string): Promise<SettlementRecord | null> {
    const record = await this.prisma.settlement.findUnique({ where: { id } });
    return record ? mapSettlement(record) : null;
  }

  async list(filters: SettlementFilters): Promise<{ items: SettlementRecord[]; total: number }> {
    const where = {
      ...(filters.batchId ? { batchId: filters.batchId } : {}),
      ...(filters.paymentId ? { paymentId: filters.paymentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.settlement.count({ where }),
    ]);
    return { items: items.map(mapSettlement), total };
  }

  async update(id: string, data: UpdateSettlementData): Promise<SettlementRecord> {
    const record = await this.prisma.settlement.update({
      where: { id },
      data: {
        status: data.status,
        auditTrail: data.auditTrail,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        failedAt: data.failedAt,
        failureReason: data.failureReason,
      },
    });
    return mapSettlement(record);
  }
}

@Injectable()
export class PrismaSettlementBatchRepository implements SettlementBatchRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateSettlementBatchData): Promise<SettlementBatchRecord> {
    const record = await this.prisma.settlementBatch.create({
      data: {
        reference: data.reference,
        mode: data.mode,
        currency: data.currency,
        totalAmount: new Prisma.Decimal(data.totalAmount ?? '0'),
        paymentCount: data.paymentCount ?? 0,
        scheduledAt: data.scheduledAt ?? null,
        metadata: data.metadata,
      },
    });
    return mapBatch(record);
  }

  async findById(id: string): Promise<SettlementBatchRecord | null> {
    const record = await this.prisma.settlementBatch.findUnique({ where: { id } });
    return record ? mapBatch(record) : null;
  }

  async list(
    filters: SettlementBatchFilters,
  ): Promise<{ items: SettlementBatchRecord[]; total: number }> {
    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.mode ? { mode: filters.mode } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.settlementBatch.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.settlementBatch.count({ where }),
    ]);
    return { items: items.map(mapBatch), total };
  }

  async update(id: string, data: UpdateSettlementBatchData): Promise<SettlementBatchRecord> {
    const record = await this.prisma.settlementBatch.update({
      where: { id },
      data: {
        status: data.status,
        totalAmount:
          data.totalAmount !== undefined ? new Prisma.Decimal(data.totalAmount) : undefined,
        paymentCount: data.paymentCount,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        failedAt: data.failedAt,
        failureReason: data.failureReason,
        report: data.report,
      },
    });
    return mapBatch(record);
  }
}
