import { Inject, Injectable } from '@nestjs/common';
import { type ChargebackStatus, Prisma, PrismaService } from '@auvora/database';
import type {
  ChargebackFilters,
  ChargebackRecord,
  ChargebackRepositoryPort,
  CreateChargebackData,
  UpdateChargebackData,
} from '../../application/ports/chargeback-repository.port';

function mapChargeback(record: {
  id: string;
  paymentId: string;
  status: ChargebackStatus;
  amount: Prisma.Decimal;
  currency: string;
  reason: string | null;
  providerRef: string | null;
  metadata: unknown;
  openedAt: Date;
  closedAt: Date | null;
  updatedAt: Date;
}): ChargebackRecord {
  return {
    id: record.id,
    paymentId: record.paymentId,
    status: record.status,
    amount: record.amount.toString(),
    currency: record.currency,
    reason: record.reason,
    providerRef: record.providerRef,
    metadata: record.metadata as ChargebackRecord['metadata'],
    openedAt: record.openedAt,
    closedAt: record.closedAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class PrismaChargebackRepository implements ChargebackRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateChargebackData): Promise<ChargebackRecord> {
    const record = await this.prisma.chargeback.create({
      data: {
        paymentId: data.paymentId,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency,
        reason: data.reason ?? null,
        providerRef: data.providerRef ?? null,
        metadata: data.metadata,
      },
    });
    return mapChargeback(record);
  }

  async findById(id: string): Promise<ChargebackRecord | null> {
    const record = await this.prisma.chargeback.findUnique({ where: { id } });
    return record ? mapChargeback(record) : null;
  }

  async list(filters: ChargebackFilters): Promise<{ items: ChargebackRecord[]; total: number }> {
    const where = {
      ...(filters.paymentId ? { paymentId: filters.paymentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.chargeback.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { openedAt: 'desc' },
      }),
      this.prisma.chargeback.count({ where }),
    ]);
    return { items: items.map(mapChargeback), total };
  }

  async update(id: string, data: UpdateChargebackData): Promise<ChargebackRecord> {
    const record = await this.prisma.chargeback.update({
      where: { id },
      data: {
        status: data.status,
        closedAt: data.closedAt,
      },
    });
    return mapChargeback(record);
  }
}
