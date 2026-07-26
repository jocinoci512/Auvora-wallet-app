import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type ObsServiceDomain } from '@auvora/database';

@Injectable()
export class MetricsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listDefinitions(domain?: ObsServiceDomain) {
    return this.prisma.obsMetricDefinition.findMany({
      where: { ...(domain ? { domain } : {}), isEnabled: true },
      orderBy: { code: 'asc' },
    });
  }

  async recentSamples(code: string, take = 100) {
    const metric = await this.prisma.obsMetricDefinition.findUnique({ where: { code } });
    if (!metric) {
      return { metric: null, samples: [] };
    }
    const samples = await this.prisma.obsMetricSample.findMany({
      where: { metricId: metric.id },
      orderBy: { observedAt: 'desc' },
      take,
    });
    return { metric, samples };
  }

  async summaryByDomain() {
    const definitions = await this.prisma.obsMetricDefinition.findMany({ where: { isEnabled: true } });
    const grouped = new Map<string, number>();
    for (const def of definitions) {
      grouped.set(def.domain, (grouped.get(def.domain) ?? 0) + 1);
    }
    return [...grouped.entries()].map(([domain, count]) => ({ domain, count }));
  }
}
