import { InsightsService } from './insights.service';

describe('InsightsService', () => {
  const kpis = {
    list: jest.fn().mockResolvedValue([
      {
        code: 'kpi.dau',
        name: 'DAU',
        warningThreshold: 90,
        criticalThreshold: 80,
        higherIsBetter: true,
      },
    ]),
    evaluate: jest.fn().mockResolvedValue({
      evaluation: { status: 'ok', currentValue: 100, targetValue: 100 },
    }),
  };

  it('returns platform insights summary', async () => {
    const prisma = {
      analyticsEvent: { count: jest.fn().mockResolvedValueOnce(100).mockResolvedValueOnce(5) },
      metricDefinition: { count: jest.fn().mockResolvedValue(7) },
      aggregationJob: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new InsightsService(prisma as never, kpis as never);
    const summary = await service.summary();
    expect(summary.events.total).toBe(100);
    expect(summary.events.unprocessed).toBe(5);
    expect(summary.kpis.statuses).toHaveLength(1);
  });

  it('evaluates all KPIs', async () => {
    const prisma = {} as never;
    const service = new InsightsService(prisma, kpis as never);
    const results = await service.evaluateAllKpis();
    expect(results).toHaveLength(1);
    expect(results[0]?.code).toBe('kpi.dau');
  });
});
