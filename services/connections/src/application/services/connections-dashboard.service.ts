import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { ConnectionProviderRegistry } from '../../infrastructure/providers/provider-registry';

@Injectable()
export class ConnectionsDashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConnectionProviderRegistry) private readonly registry: ConnectionProviderRegistry,
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

  async connections() {
    return this.prisma.externalWalletConnection.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async sessions() {
    const [active, pending, terminated, dappPending, trusted] = await Promise.all([
      this.prisma.walletConnectSession.count({ where: { status: 'ACTIVE' } }),
      this.prisma.walletConnectSession.count({ where: { status: 'PENDING' } }),
      this.prisma.walletConnectSession.count({ where: { status: 'TERMINATED' } }),
      this.prisma.dappConnectionRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.trustedDapp.count({ where: { status: 'TRUSTED' } }),
    ]);
    return { active, pending, terminated, dappPendingRequests: dappPending, trustedDapps: trusted };
  }

  async dappAnalytics() {
    const [requests, grants, bookmarks, events] = await Promise.all([
      this.prisma.dappConnectionRequest.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.dappPermissionGrant.count({ where: { allowed: true, revokedAt: null } }),
      this.prisma.dappBrowserBookmark.count(),
      this.prisma.dappActivityEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 25 }),
    ]);
    return {
      requestsByStatus: requests.map((r) => ({ status: r.status, count: r._count._all })),
      activePermissionGrants: grants,
      browserBookmarks: bookmarks,
      recentActivity: events,
    };
  }

  async devices() {
    return this.prisma.hardwareDevice.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async syncStatus() {
    const jobs = await this.prisma.connectionSyncJob.findMany({
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
