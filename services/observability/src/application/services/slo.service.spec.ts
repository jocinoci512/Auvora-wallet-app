import { calculateSli } from '../../domain';
import { SloService } from './slo.service';

describe('SloService', () => {
  it('records measurement with calculated SLI', async () => {
    const prisma = {
      obsSloDefinition: {
        findUnique: jest.fn().mockResolvedValue({
          id: 's1',
          code: 'gateway_availability',
          targetPercent: 99.9,
        }),
      },
      obsSliMeasurement: {
        upsert: jest.fn().mockImplementation(async ({ create }) => create),
      },
    };
    const service = new SloService(prisma as never);
    const windowStart = new Date('2026-07-01T00:00:00Z');
    const windowEnd = new Date('2026-07-31T00:00:00Z');
    const result = await service.recordMeasurement({
      code: 'gateway_availability',
      windowStart,
      windowEnd,
      goodEvents: 999,
      totalEvents: 1000,
    });
    const expected = calculateSli({ goodEvents: 999, totalEvents: 1000, targetPercent: 99.9 });
    expect(result.sliPercent).toBeCloseTo(expected.sliPercent);
    expect(prisma.obsSliMeasurement.upsert).toHaveBeenCalled();
  });

  it('reports latency, error rate, uptime against SLO targets', async () => {
    const prisma = {
      obsSloDefinition: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: 'gateway_availability',
            name: 'Gateway availability',
            serviceName: 'gateway',
            indicatorType: 'AVAILABILITY',
            targetPercent: 99.9,
            latencyMsTarget: 250,
            measurements: [
              { sliPercent: 99.95, errorBudgetRemaining: 50, reliabilityScore: 99.95 },
            ],
          },
        ]),
      },
      obsMetricDefinition: {
        findUnique: jest.fn().mockImplementation(async ({ where }: { where: { code: string } }) => {
          if (where.code === 'http_latency_ms') return { id: 'm-latency' };
          if (where.code === 'error_rate') return { id: 'm-error' };
          return null;
        }),
      },
      obsMetricSample: {
        findMany: jest
          .fn()
          .mockImplementation(async ({ where }: { where: { metricId: string } }) => {
            if (where.metricId === 'm-latency') return [{ value: 120 }, { value: 180 }];
            if (where.metricId === 'm-error') return [{ value: 0 }, { value: 0 }, { value: 1 }];
            return [];
          }),
      },
    };
    const service = new SloService(prisma as never);
    const report = await service.complianceReport();
    expect(report.platform.avgLatencyMs).toBe(150);
    expect(report.platform.errorRate).toBeCloseTo(1 / 3);
    expect(report.slos[0]?.meetsTarget).toBe(true);
    expect(report.slos[0]?.latencyWithinTarget).toBe(true);
  });
});
