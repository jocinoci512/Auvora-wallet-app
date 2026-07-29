import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { NftProviderRegistry } from '../../infrastructure/providers/provider-registry';

@Injectable()
export class NftDashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NftProviderRegistry) private readonly registry: NftProviderRegistry,
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

  async collections() {
    return this.prisma.nftCollection.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 });
  }

  async metadataStatus() {
    const [ready, pending, failed, assets] = await Promise.all([
      this.prisma.nftMediaCache.count({ where: { status: 'READY' } }),
      this.prisma.nftMediaCache.count({ where: { status: 'PENDING' } }),
      this.prisma.nftMediaCache.count({ where: { status: 'FAILED' } }),
      this.prisma.nftAsset.count(),
    ]);
    return { assets, media: { ready, pending, failed } };
  }

  async syncMetrics() {
    const jobs = await this.prisma.nftSyncJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const completed = jobs.filter((j) => j.status === 'COMPLETED');
    const avgDuration =
      completed.length === 0
        ? 0
        : Math.round(
            completed.reduce((a, j) => a + Number(j.durationMs ?? 0), 0) / completed.length,
          );
    return {
      recentJobs: jobs.length,
      averageSyncDurationMs: avgDuration,
      failureCount: jobs.filter((j) => j.status === 'FAILED').length,
    };
  }
}
