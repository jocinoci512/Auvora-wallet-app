import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { SwapProviderRegistry } from '../../infrastructure/providers/provider-registry';

@Injectable()
export class SwapDashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SwapProviderRegistry) private readonly registry: SwapProviderRegistry,
  ) {}

  async providers() {
    const health = await Promise.all(
      this.registry.listProviders().map(async (p) => {
        const provider = this.registry.getProvider(p.code);
        const check = await provider.healthCheck();
        return { ...p, ...check };
      }),
    );
    return { providers: health, registry: await this.registry.healthCheck() };
  }

  async analytics() {
    const executions = await this.prisma.swapExecution.findMany({
      take: 500,
      orderBy: { createdAt: 'desc' },
    });
    const total = executions.length;
    const completed = executions.filter((e) => e.status === 'COMPLETED').length;
    const failed = executions.filter((e) => e.status === 'FAILED').length;
    const impacts = executions
      .map((e) => Number(e.priceImpactBps ?? 0))
      .filter((n) => Number.isFinite(n));
    const avgImpact = impacts.length
      ? Math.round(impacts.reduce((a, b) => a + b, 0) / impacts.length)
      : 0;
    const latencies = await this.prisma.swapQuoteRecord.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
    });
    const quoteLatency =
      latencies.length === 0
        ? 0
        : Math.round(
            latencies.reduce((a, q) => a + Number(q.latencyMs ?? 0), 0) / latencies.length,
          );
    return {
      totalSwaps: total,
      successRate: total ? completed / total : 0,
      failureRate: total ? failed / total : 0,
      averagePriceImpactBps: avgImpact,
      averageQuoteLatencyMs: quoteLatency,
    };
  }

  async failures() {
    return this.prisma.swapExecution.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async routesMonitor() {
    return this.prisma.swapRouteSnapshot.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
