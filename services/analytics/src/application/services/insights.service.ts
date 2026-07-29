import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { evaluateKpi } from '../../domain';
import { KpiService } from './kpi.service';

@Injectable()
export class InsightsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KpiService) private readonly kpis: KpiService,
  ) {}

  async summary() {
    const [eventCount, unprocessedEvents, metricCount, kpiDefinitions, recentJobs] =
      await Promise.all([
        this.prisma.analyticsEvent.count(),
        this.prisma.analyticsEvent.count({ where: { processedAt: null } }),
        this.prisma.metricDefinition.count({ where: { isEnabled: true } }),
        this.kpis.list({ enabledOnly: true }),
        this.prisma.aggregationJob.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

    const kpiStatuses = [];
    for (const kpi of kpiDefinitions.slice(0, 10)) {
      const evaluated = await this.kpis.evaluate(kpi.code);
      kpiStatuses.push({
        code: kpi.code,
        name: kpi.name,
        status: evaluated.evaluation.status,
        currentValue: evaluated.evaluation.currentValue,
        targetValue: evaluated.evaluation.targetValue,
      });
    }

    const criticalKpis = kpiStatuses.filter((entry) => entry.status === 'critical').length;
    const warningKpis = kpiStatuses.filter((entry) => entry.status === 'warning').length;

    return {
      events: { total: eventCount, unprocessed: unprocessedEvents },
      metrics: { enabled: metricCount },
      kpis: {
        tracked: kpiDefinitions.length,
        critical: criticalKpis,
        warning: warningKpis,
        statuses: kpiStatuses,
      },
      recentAggregationJobs: recentJobs,
      highlights: [
        criticalKpis > 0 ? `${criticalKpis} KPI(s) in critical state` : 'No critical KPI breaches',
        unprocessedEvents > 0
          ? `${unprocessedEvents} events awaiting aggregation`
          : 'Event pipeline caught up',
      ],
    };
  }

  async evaluateAllKpis() {
    const definitions = await this.kpis.list({ enabledOnly: true });
    const results = [];
    for (const kpi of definitions) {
      const evaluated = await this.kpis.evaluate(kpi.code);
      results.push({
        code: kpi.code,
        evaluation: evaluateKpi({
          currentValue: evaluated.evaluation.currentValue,
          targetValue: evaluated.evaluation.targetValue,
          warningThreshold: kpi.warningThreshold,
          criticalThreshold: kpi.criticalThreshold,
          higherIsBetter: kpi.higherIsBetter,
        }),
      });
    }
    return results;
  }
}
