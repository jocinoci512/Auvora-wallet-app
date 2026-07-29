import { Inject, Injectable } from '@nestjs/common';
import { type LimitWindow, Prisma, PrismaService } from '@auvora/database';
import type {
  CreatePaymentLimitData,
  LimitRepositoryPort,
  PaymentLimitFilters,
  PaymentLimitRecord,
  UpdatePaymentLimitData,
} from '../../application/ports/limit-repository.port';

function mapLimit(record: {
  id: string;
  window: LimitWindow;
  amount: Prisma.Decimal;
  currency: string | null;
  assetCode: string | null;
  ownerUserId: string | null;
  accountTier: string | null;
  country: string | null;
  riskProfile: string | null;
  isEnabled: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): PaymentLimitRecord {
  return {
    id: record.id,
    window: record.window,
    amount: record.amount.toString(),
    currency: record.currency,
    assetCode: record.assetCode,
    ownerUserId: record.ownerUserId,
    accountTier: record.accountTier,
    country: record.country,
    riskProfile: record.riskProfile,
    isEnabled: record.isEnabled,
    metadata: record.metadata as PaymentLimitRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class PrismaLimitRepository implements LimitRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreatePaymentLimitData): Promise<PaymentLimitRecord> {
    const record = await this.prisma.paymentLimit.create({
      data: {
        window: data.window,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency ?? null,
        assetCode: data.assetCode ?? null,
        ownerUserId: data.ownerUserId ?? null,
        accountTier: data.accountTier ?? null,
        country: data.country ?? null,
        riskProfile: data.riskProfile ?? null,
        isEnabled: data.isEnabled ?? true,
        metadata: data.metadata,
      },
    });
    return mapLimit(record);
  }

  async findById(id: string): Promise<PaymentLimitRecord | null> {
    const record = await this.prisma.paymentLimit.findUnique({ where: { id } });
    return record ? mapLimit(record) : null;
  }

  async list(
    filters: PaymentLimitFilters,
  ): Promise<{ items: PaymentLimitRecord[]; total: number }> {
    const where = {
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.accountTier ? { accountTier: filters.accountTier } : {}),
      ...(filters.country ? { country: filters.country } : {}),
      ...(filters.riskProfile ? { riskProfile: filters.riskProfile } : {}),
      ...(filters.window ? { window: filters.window } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.paymentLimit.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.paymentLimit.count({ where }),
    ]);
    return { items: items.map(mapLimit), total };
  }

  async findApplicable(criteria: {
    ownerUserId: string;
    accountTier?: string | null;
    country?: string | null;
    riskProfile?: string | null;
  }): Promise<PaymentLimitRecord[]> {
    const tier = criteria.accountTier?.trim() || 'standard';
    const records = await this.prisma.paymentLimit.findMany({
      where: {
        isEnabled: true,
        OR: [
          // User-specific limits
          { ownerUserId: criteria.ownerUserId },
          // Global defaults (no owner) for the resolved account tier
          { ownerUserId: null, accountTier: tier },
          // Global defaults with no tier scoping
          { ownerUserId: null, accountTier: null, country: null, riskProfile: null },
          ...(criteria.country
            ? [
                {
                  ownerUserId: null,
                  country: criteria.country,
                } satisfies Prisma.PaymentLimitWhereInput,
              ]
            : []),
          ...(criteria.riskProfile
            ? [
                {
                  ownerUserId: null,
                  riskProfile: criteria.riskProfile,
                } satisfies Prisma.PaymentLimitWhereInput,
              ]
            : []),
        ],
      },
    });
    return records.map(mapLimit);
  }

  async update(id: string, data: UpdatePaymentLimitData): Promise<PaymentLimitRecord> {
    const record = await this.prisma.paymentLimit.update({
      where: { id },
      data: {
        amount: data.amount !== undefined ? new Prisma.Decimal(data.amount) : undefined,
        isEnabled: data.isEnabled,
        metadata: data.metadata,
      },
    });
    return mapLimit(record);
  }
}
