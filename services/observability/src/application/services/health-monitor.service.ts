import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type ObsHealthStatus } from '@auvora/database';

@Injectable()
export class HealthMonitorService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listRecent(serviceName?: string, take = 100) {
    return this.prisma.obsHealthCheck.findMany({
      where: serviceName ? { serviceName } : undefined,
      orderBy: { checkedAt: 'desc' },
      take,
    });
  }

  async serviceStatusMap() {
    const checks = await this.prisma.obsHealthCheck.findMany({
      orderBy: { checkedAt: 'desc' },
      take: 500,
    });
    const latest = new Map<
      string,
      { checkName: string; status: ObsHealthStatus; checkedAt: Date }
    >();
    for (const check of checks) {
      const key = `${check.serviceName}:${check.checkName}`;
      if (!latest.has(key)) {
        latest.set(key, {
          checkName: check.checkName,
          status: check.status,
          checkedAt: check.checkedAt,
        });
      }
    }
    const byService = new Map<
      string,
      Array<{ checkName: string; status: ObsHealthStatus; checkedAt: Date }>
    >();
    for (const [key, value] of latest.entries()) {
      const serviceName = key.split(':')[0]!;
      const list = byService.get(serviceName) ?? [];
      list.push(value);
      byService.set(serviceName, list);
    }
    return [...byService.entries()].map(([serviceName, probes]) => {
      const unhealthy = probes.some((p) => p.status === 'UNHEALTHY');
      const degraded = probes.some((p) => p.status === 'DEGRADED');
      const status: ObsHealthStatus = unhealthy ? 'UNHEALTHY' : degraded ? 'DEGRADED' : 'HEALTHY';
      return { serviceName, status, probes };
    });
  }
}
