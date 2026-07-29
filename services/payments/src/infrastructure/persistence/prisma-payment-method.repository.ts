import { Inject, Injectable } from '@nestjs/common';
import { type PaymentMethodType, PrismaService } from '@auvora/database';
import type {
  CreatePaymentMethodData,
  PaymentMethodFilters,
  PaymentMethodRecord,
  PaymentMethodRepositoryPort,
  UpdatePaymentMethodData,
} from '../../application/ports/payment-method-repository.port';

function mapMethod(record: {
  id: string;
  ownerUserId: string;
  type: PaymentMethodType;
  label: string | null;
  isDefault: boolean;
  isActive: boolean;
  last4: string | null;
  country: string | null;
  currency: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}): PaymentMethodRecord {
  return {
    id: record.id,
    ownerUserId: record.ownerUserId,
    type: record.type,
    label: record.label,
    isDefault: record.isDefault,
    isActive: record.isActive,
    last4: record.last4,
    country: record.country,
    currency: record.currency,
    metadata: record.metadata as PaymentMethodRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  };
}

@Injectable()
export class PrismaPaymentMethodRepository implements PaymentMethodRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreatePaymentMethodData): Promise<PaymentMethodRecord> {
    const record = await this.prisma.paymentMethod.create({
      data: {
        ownerUserId: data.ownerUserId,
        type: data.type,
        label: data.label ?? null,
        last4: data.last4 ?? null,
        country: data.country ?? null,
        currency: data.currency ?? null,
        isDefault: data.isDefault ?? false,
        metadata: data.metadata,
      },
    });
    return mapMethod(record);
  }

  async findById(id: string): Promise<PaymentMethodRecord | null> {
    const record = await this.prisma.paymentMethod.findUnique({ where: { id } });
    return record ? mapMethod(record) : null;
  }

  async list(
    filters: PaymentMethodFilters,
  ): Promise<{ items: PaymentMethodRecord[]; total: number }> {
    const where = {
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.paymentMethod.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.paymentMethod.count({ where }),
    ]);
    return { items: items.map(mapMethod), total };
  }

  async update(id: string, data: UpdatePaymentMethodData): Promise<PaymentMethodRecord> {
    const record = await this.prisma.paymentMethod.update({
      where: { id },
      data: {
        label: data.label,
        isDefault: data.isDefault,
        isActive: data.isActive,
        metadata: data.metadata,
        archivedAt: data.archivedAt,
      },
    });
    return mapMethod(record);
  }

  async clearDefault(ownerUserId: string): Promise<void> {
    await this.prisma.paymentMethod.updateMany({
      where: { ownerUserId, isDefault: true },
      data: { isDefault: false },
    });
  }
}
