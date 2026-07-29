import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@auvora/database';

export interface UsageFilters {
  ownerUserId?: string;
  providerCode?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class UsageService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async summary(filters: UsageFilters = {}) {
    const where = {
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.providerCode ? { providerCode: filters.providerCode } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    const requestWhere: Prisma.AiRequestWhereInput = {
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.providerCode ? { provider: { code: filters.providerCode } } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    const [aggregate, requestCount, latencyAggregate, totalRequestsForRate, cacheHitCount] =
      await Promise.all([
        this.prisma.aiTokenUsage.aggregate({
          where,
          _sum: { inputTokens: true, outputTokens: true, totalTokens: true, costUsdMicros: true },
          _count: true,
        }),
        this.prisma.aiTokenUsage.count({ where }),
        this.prisma.aiRequest.aggregate({ where: requestWhere, _avg: { latencyMs: true } }),
        this.prisma.aiRequest.count({ where: requestWhere }),
        this.prisma.aiRequest.count({ where: { ...requestWhere, cacheHit: true } }),
      ]);

    const totalCostUsdMicros = aggregate._sum.costUsdMicros ?? 0;

    return {
      totalRequests: requestCount,
      totalInputTokens: aggregate._sum.inputTokens ?? 0,
      totalOutputTokens: aggregate._sum.outputTokens ?? 0,
      totalTokens: aggregate._sum.totalTokens ?? 0,
      totalCostUsdMicros,
      // Costs are estimates derived from the static per-model rate table in domain/cost-policy.ts,
      // not provider-billed invoices.
      estimatedCostUsd: totalCostUsdMicros / 1_000_000,
      averageLatencyMs: latencyAggregate._avg.latencyMs ?? 0,
      cacheHitRate: totalRequestsForRate > 0 ? cacheHitCount / totalRequestsForRate : 0,
    };
  }

  async byProvider(filters: UsageFilters = {}) {
    const where = {
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };
    const grouped = await this.prisma.aiTokenUsage.groupBy({
      by: ['providerCode'],
      where,
      _sum: { totalTokens: true, costUsdMicros: true },
      _count: true,
    });
    return grouped.map((row) => ({
      providerCode: row.providerCode,
      requests: row._count,
      totalTokens: row._sum.totalTokens ?? 0,
      totalCostUsdMicros: row._sum.costUsdMicros ?? 0,
      estimatedCostUsd: (row._sum.costUsdMicros ?? 0) / 1_000_000,
    }));
  }

  async byOwner(ownerUserId: string, filters: { from?: Date; to?: Date } = {}) {
    return this.summary({ ownerUserId, ...filters });
  }

  async recent(filters: UsageFilters & { skip?: number; take?: number } = {}) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 200);
    const where = {
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.providerCode ? { providerCode: filters.providerCode } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.aiTokenUsage.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.aiTokenUsage.count({ where }),
    ]);
    return { items, total, skip, take };
  }
}
