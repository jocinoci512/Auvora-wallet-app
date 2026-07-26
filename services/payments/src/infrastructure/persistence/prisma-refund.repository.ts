import { Inject, Injectable } from '@nestjs/common';
import { type PaymentStatus, Prisma, PrismaService } from '@auvora/database';
import type {
  CreateRefundData,
  RefundFilters,
  RefundRecord,
  RefundRepositoryPort,
  UpdateRefundData,
} from '../../application/ports/refund-repository.port';

function mapRefund(record: {
  id: string;
  paymentId: string;
  amount: Prisma.Decimal;
  currency: string;
  status: PaymentStatus;
  reason: string | null;
  providerRef: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): RefundRecord {
  return {
    id: record.id,
    paymentId: record.paymentId,
    amount: record.amount.toString(),
    currency: record.currency,
    status: record.status,
    reason: record.reason,
    providerRef: record.providerRef,
    metadata: record.metadata as RefundRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
  };
}

@Injectable()
export class PrismaRefundRepository implements RefundRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateRefundData): Promise<RefundRecord> {
    const record = await this.prisma.refund.create({
      data: {
        paymentId: data.paymentId,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency,
        status: data.status ?? 'CREATED',
        reason: data.reason ?? null,
        providerRef: data.providerRef ?? null,
        metadata: data.metadata,
      },
    });
    return mapRefund(record);
  }

  async findById(id: string): Promise<RefundRecord | null> {
    const record = await this.prisma.refund.findUnique({ where: { id } });
    return record ? mapRefund(record) : null;
  }

  async list(filters: RefundFilters): Promise<{ items: RefundRecord[]; total: number }> {
    const where = {
      ...(filters.paymentId ? { paymentId: filters.paymentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.refund.count({ where }),
    ]);
    return { items: items.map(mapRefund), total };
  }

  async update(id: string, data: UpdateRefundData): Promise<RefundRecord> {
    const record = await this.prisma.refund.update({
      where: { id },
      data: {
        status: data.status,
        providerRef: data.providerRef,
        completedAt: data.completedAt,
      },
    });
    return mapRefund(record);
  }
}
