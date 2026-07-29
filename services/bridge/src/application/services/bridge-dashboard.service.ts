import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { BridgeProviderRegistry } from '../../infrastructure/providers/provider-registry';

@Injectable()
export class BridgeDashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BridgeProviderRegistry) private readonly registry: BridgeProviderRegistry,
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

  async routes() {
    return this.registry.listRoutes();
  }

  async failures() {
    const failed = await this.prisma.bridgeTransfer.count({ where: { status: 'FAILED' } });
    const completed = await this.prisma.bridgeTransfer.count({ where: { status: 'COMPLETED' } });
    const total = failed + completed;
    return {
      failed,
      completed,
      failureRate: total === 0 ? 0 : Number((failed / total).toFixed(4)),
      successRate: total === 0 ? 0 : Number((completed / total).toFixed(4)),
    };
  }

  async syncStatus() {
    const jobs = await this.prisma.bridgeSyncJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const completed = jobs.filter((j) => j.status === 'COMPLETED');
    const avg =
      completed.length === 0
        ? 0
        : Math.round(
            completed.reduce((a, j) => a + Number(j.durationMs ?? 0), 0) / completed.length,
          );
    return {
      recentJobs: jobs.length,
      averageDurationMs: avg,
      failureCount: jobs.filter((j) => j.status === 'FAILED').length,
    };
  }
}
