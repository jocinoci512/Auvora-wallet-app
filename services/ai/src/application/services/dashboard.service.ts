import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { ModelRouterService } from './model-router.service';
import { UsageService } from './usage.service';

const METRICS_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ModelRouterService) private readonly modelRouter: ModelRouterService,
    @Inject(UsageService) private readonly usage: UsageService,
  ) {}

  async metrics() {
    const [total, succeeded, failed, cached, avgLatency, conversations, activeConversations] =
      await Promise.all([
        this.prisma.aiRequest.count(),
        this.prisma.aiRequest.count({ where: { status: 'SUCCEEDED' } }),
        this.prisma.aiRequest.count({ where: { status: 'FAILED' } }),
        this.prisma.aiRequest.count({ where: { cacheHit: true } }),
        this.prisma.aiRequest.aggregate({ _avg: { latencyMs: true } }),
        this.prisma.aiConversation.count(),
        this.prisma.aiConversation.count({ where: { status: 'ACTIVE' } }),
      ]);

    const providers = await this.modelRouter.status();
    const usageSummary = await this.usage.summary();
    const providerMetrics = await this.providerMetricsLast24h();

    return {
      totalRequests: total,
      succeededRequests: succeeded,
      failedRequests: failed,
      successRate: total > 0 ? succeeded / total : 1,
      cacheHitRate: total > 0 ? cached / total : 0,
      averageLatencyMs: avgLatency._avg.latencyMs ?? 0,
      conversations,
      activeConversations,
      providers,
      // Per-provider request/latency/token/cost aggregates for the last 24h, sourced from
      // AiProviderMetric (hourly windows bumped by ChatService on every request).
      providerMetrics,
      usage: usageSummary,
      totalTokens: usageSummary.totalTokens,
      totalCostUsdMicros: usageSummary.totalCostUsdMicros,
      // Cost figures are estimates derived from the static per-model rate table in
      // domain/cost-policy.ts, not provider-billed invoices.
      estimatedCostUsd: usageSummary.estimatedCostUsd,
    };
  }

  private async providerMetricsLast24h() {
    const since = new Date(Date.now() - METRICS_WINDOW_MS);
    const grouped = await this.prisma.aiProviderMetric.groupBy({
      by: ['providerId'],
      where: { windowStart: { gte: since } },
      _sum: {
        requestCount: true,
        successCount: true,
        failureCount: true,
        cacheHitCount: true,
        totalLatencyMs: true,
        totalTokens: true,
        totalCostMicros: true,
      },
    });
    if (grouped.length === 0) return [];

    const providerRows = await this.prisma.aiProvider.findMany({
      where: { id: { in: grouped.map((row) => row.providerId) } },
    });
    const providerById = new Map(providerRows.map((row) => [row.id, row]));

    return grouped.map((row) => {
      const provider = providerById.get(row.providerId);
      const requestCount = row._sum.requestCount ?? 0;
      const totalLatencyMs = Number(row._sum.totalLatencyMs ?? 0n);
      const totalCostMicros = Number(row._sum.totalCostMicros ?? 0n);
      return {
        providerCode: provider?.code ?? 'unknown',
        providerName: provider?.name ?? 'unknown',
        requestCount,
        successCount: row._sum.successCount ?? 0,
        failureCount: row._sum.failureCount ?? 0,
        cacheHitCount: row._sum.cacheHitCount ?? 0,
        averageLatencyMs: requestCount > 0 ? totalLatencyMs / requestCount : 0,
        totalTokens: Number(row._sum.totalTokens ?? 0n),
        totalCostUsdMicros: totalCostMicros,
        estimatedCostUsd: totalCostMicros / 1_000_000,
      };
    });
  }

  async auditTrail(skip = 0, take = 50) {
    const [items, total] = await Promise.all([
      this.prisma.aiAuditRecord.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(take, 200),
      }),
      this.prisma.aiAuditRecord.count(),
    ]);
    return { items, total, skip, take };
  }
}
