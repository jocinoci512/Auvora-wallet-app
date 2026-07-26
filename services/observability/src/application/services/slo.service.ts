import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type ObsServiceDomain,
  type ObsSloIndicatorType,
  type Prisma,
} from '@auvora/database';
import { calculateSli, NotFoundError } from '../../domain';

@Injectable()
export class SloService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.obsSloDefinition.findMany({
      where: { isEnabled: true },
      orderBy: { code: 'asc' },
      include: { measurements: { orderBy: { windowEnd: 'desc' }, take: 1 } },
    });
  }

  create(input: {
    code: string;
    name: string;
    description?: string;
    serviceName: string;
    domain: ObsServiceDomain;
    indicatorType: ObsSloIndicatorType;
    targetPercent: number;
    latencyMsTarget?: number;
    windowDays?: number;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.obsSloDefinition.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        serviceName: input.serviceName,
        domain: input.domain,
        indicatorType: input.indicatorType,
        targetPercent: input.targetPercent,
        latencyMsTarget: input.latencyMsTarget,
        windowDays: input.windowDays ?? 30,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
      },
    });
  }

  async recordMeasurement(input: {
    code: string;
    windowStart: Date;
    windowEnd: Date;
    goodEvents: number;
    totalEvents: number;
  }) {
    const slo = await this.prisma.obsSloDefinition.findUnique({ where: { code: input.code } });
    if (!slo) {
      throw new NotFoundError(`SLO ${input.code} not found`);
    }
    const calc = calculateSli({
      goodEvents: input.goodEvents,
      totalEvents: input.totalEvents,
      targetPercent: slo.targetPercent,
    });
    return this.prisma.obsSliMeasurement.upsert({
      where: {
        sloId_windowStart_windowEnd: {
          sloId: slo.id,
          windowStart: input.windowStart,
          windowEnd: input.windowEnd,
        },
      },
      create: {
        sloId: slo.id,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        goodEvents: input.goodEvents,
        totalEvents: input.totalEvents,
        sliPercent: calc.sliPercent,
        errorBudgetRemaining: calc.errorBudgetRemaining,
        reliabilityScore: calc.reliabilityScore,
      },
      update: {
        goodEvents: input.goodEvents,
        totalEvents: input.totalEvents,
        sliPercent: calc.sliPercent,
        errorBudgetRemaining: calc.errorBudgetRemaining,
        reliabilityScore: calc.reliabilityScore,
      },
    });
  }

  async complianceReport() {
    const definitions = await this.prisma.obsSloDefinition.findMany({
      where: { isEnabled: true },
      orderBy: { code: 'asc' },
      include: { measurements: { orderBy: { windowEnd: 'desc' }, take: 1 } },
    });

    const latencyMetric = await this.prisma.obsMetricDefinition.findUnique({
      where: { code: 'http_latency_ms' },
    });
    const errorMetric = await this.prisma.obsMetricDefinition.findUnique({
      where: { code: 'error_rate' },
    });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [latencySamples, errorSamples] = await Promise.all([
      latencyMetric
        ? this.prisma.obsMetricSample.findMany({
            where: { metricId: latencyMetric.id, observedAt: { gte: since } },
            orderBy: { observedAt: 'desc' },
            take: 500,
          })
        : Promise.resolve([]),
      errorMetric
        ? this.prisma.obsMetricSample.findMany({
            where: { metricId: errorMetric.id, observedAt: { gte: since } },
            orderBy: { observedAt: 'desc' },
            take: 500,
          })
        : Promise.resolve([]),
    ]);

    const avgLatency =
      latencySamples.length > 0
        ? latencySamples.reduce((sum, s) => sum + s.value, 0) / latencySamples.length
        : null;
    const errorRate =
      errorSamples.length > 0
        ? errorSamples.reduce((sum, s) => sum + s.value, 0) / errorSamples.length
        : null;
    const uptimePercent =
      errorRate == null ? null : Math.max(0, Math.min(100, (1 - errorRate) * 100));

    return {
      generatedAt: new Date().toISOString(),
      windowHours: 24,
      platform: {
        avgLatencyMs: avgLatency,
        errorRate,
        uptimePercent,
        latencySampleCount: latencySamples.length,
        errorSampleCount: errorSamples.length,
      },
      slos: definitions.map((slo) => {
        const latest = slo.measurements[0] ?? null;
        const meetsTarget = latest ? latest.sliPercent >= slo.targetPercent : null;
        const latencyOk =
          slo.latencyMsTarget == null || avgLatency == null
            ? null
            : avgLatency <= slo.latencyMsTarget;
        return {
          code: slo.code,
          name: slo.name,
          serviceName: slo.serviceName,
          indicatorType: slo.indicatorType,
          targetPercent: slo.targetPercent,
          latencyMsTarget: slo.latencyMsTarget,
          latestSliPercent: latest?.sliPercent ?? null,
          errorBudgetRemaining: latest?.errorBudgetRemaining ?? null,
          reliabilityScore: latest?.reliabilityScore ?? null,
          meetsTarget,
          latencyWithinTarget: latencyOk,
        };
      }),
    };
  }
}
