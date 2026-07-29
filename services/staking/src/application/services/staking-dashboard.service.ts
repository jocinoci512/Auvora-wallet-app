import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { StakingProviderRegistry } from '../../infrastructure/providers/provider-registry';

@Injectable()
export class StakingDashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StakingProviderRegistry) private readonly registry: StakingProviderRegistry,
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

  async validators() {
    return this.prisma.stakingValidator.findMany({
      orderBy: { performanceScore: 'desc' },
      take: 100,
    });
  }

  async rewards() {
    const [claimed, claimable, activePositions] = await Promise.all([
      this.prisma.stakingReward.count({ where: { status: 'CLAIMED' } }),
      this.prisma.stakingReward.count({ where: { status: 'CLAIMABLE' } }),
      this.prisma.stakingPosition.count({ where: { status: 'ACTIVE' } }),
    ]);
    return {
      claimedRewards: claimed,
      claimableRewards: claimable,
      activePositions,
    };
  }

  async syncStatus() {
    const jobs = await this.prisma.stakingSyncJob.findMany({
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
