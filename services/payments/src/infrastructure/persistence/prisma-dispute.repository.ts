import { Inject, Injectable } from '@nestjs/common';
import { type DisputeStatus, Prisma, PrismaService } from '@auvora/database';
import type {
  CreateDisputeData,
  DisputeFilters,
  DisputeRecord,
  DisputeRepositoryPort,
  UpdateDisputeData,
} from '../../application/ports/dispute-repository.port';

function mapDispute(record: {
  id: string;
  paymentId: string;
  status: DisputeStatus;
  reason: string | null;
  amount: Prisma.Decimal | null;
  currency: string | null;
  metadata: unknown;
  openedAt: Date;
  closedAt: Date | null;
  updatedAt: Date;
}): DisputeRecord {
  return {
    id: record.id,
    paymentId: record.paymentId,
    status: record.status,
    reason: record.reason,
    amount: record.amount !== null ? record.amount.toString() : null,
    currency: record.currency,
    metadata: record.metadata as DisputeRecord['metadata'],
    openedAt: record.openedAt,
    closedAt: record.closedAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class PrismaDisputeRepository implements DisputeRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateDisputeData): Promise<DisputeRecord> {
    const record = await this.prisma.dispute.create({
      data: {
        paymentId: data.paymentId,
        reason: data.reason ?? null,
        amount:
          data.amount !== undefined && data.amount !== null
            ? new Prisma.Decimal(data.amount)
            : undefined,
        currency: data.currency ?? null,
        metadata: data.metadata,
      },
    });
    return mapDispute(record);
  }

  async findById(id: string): Promise<DisputeRecord | null> {
    const record = await this.prisma.dispute.findUnique({ where: { id } });
    return record ? mapDispute(record) : null;
  }

  async list(filters: DisputeFilters): Promise<{ items: DisputeRecord[]; total: number }> {
    const where = {
      ...(filters.paymentId ? { paymentId: filters.paymentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { openedAt: 'desc' },
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return { items: items.map(mapDispute), total };
  }

  async update(id: string, data: UpdateDisputeData): Promise<DisputeRecord> {
    const record = await this.prisma.dispute.update({
      where: { id },
      data: {
        status: data.status,
        closedAt: data.closedAt,
      },
    });
    return mapDispute(record);
  }
}
