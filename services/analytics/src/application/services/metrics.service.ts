import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type AggregationWindow,
  type AnalyticsDomain,
  type MetricValueType,
  type Prisma,
} from '@auvora/database';
import { bucketStart, ConflictError, NotFoundError } from '../../domain';
import { CLOCK, type ClockPort } from '../ports/clock.port';

const PERFORMANCE_METRICS = [
  'dashboard_load_ms',
  'report_generate_ms',
  'aggregation_duration_ms',
] as const;

@Injectable()
export class MetricsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async listDefinitions(filters: { domain?: AnalyticsDomain; enabledOnly?: boolean } = {}) {
    return this.prisma.metricDefinition.findMany({
      where: {
        domain: filters.domain,
        isEnabled: filters.enabledOnly ? true : undefined,
      },
      orderBy: { code: 'asc' },
    });
  }

  async getDefinition(code: string) {
    const metric = await this.prisma.metricDefinition.findUnique({ where: { code } });
    if (!metric) {
      throw new NotFoundError(`Metric definition not found: ${code}`);
    }
    return metric;
  }

  async create(input: {
    code: string;
    name: string;
    description?: string;
    domain: AnalyticsDomain;
    valueType: MetricValueType;
    unit?: string;
    formula?: string;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await this.prisma.metricDefinition.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new ConflictError(`Metric definition already exists: ${input.code}`);
    }
    return this.prisma.metricDefinition.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        domain: input.domain,
        valueType: input.valueType,
        unit: input.unit,
        formula: input.formula,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
      },
    });
  }

  async update(
    code: string,
    input: Partial<{
      name: string;
      description: string;
      valueType: MetricValueType;
      unit: string;
      formula: string;
      isEnabled: boolean;
      metadata: Record<string, unknown>;
    }>,
  ) {
    await this.getDefinition(code);
    return this.prisma.metricDefinition.update({
      where: { code },
      data: {
        ...input,
        metadata:
          input.metadata === undefined ? undefined : (input.metadata as Prisma.InputJsonValue),
      },
    });
  }

  async getValues(
    code: string,
    options: {
      window?: AggregationWindow;
      from?: Date;
      to?: Date;
      take?: number;
    } = {},
  ) {
    const metric = await this.getDefinition(code);
    return this.prisma.metricValue.findMany({
      where: {
        metricId: metric.id,
        window: options.window,
        bucketStart: {
          gte: options.from,
          lte: options.to,
        },
      },
      orderBy: { bucketStart: 'asc' },
      take: options.take ?? 500,
    });
  }

  async getLatestValue(code: string, window: AggregationWindow = 'DAILY') {
    const metric = await this.getDefinition(code);
    return this.prisma.metricValue.findFirst({
      where: { metricId: metric.id, window },
      orderBy: { bucketStart: 'desc' },
    });
  }

  async recordDuration(
    code: string,
    durationMs: number,
    window: AggregationWindow = 'REALTIME',
  ): Promise<void> {
    const metric = await this.getDefinition(code);
    const bucket = bucketStart(this.clock.now(), window);
    await this.prisma.metricValue.upsert({
      where: {
        metricId_window_bucketStart: {
          metricId: metric.id,
          window,
          bucketStart: bucket,
        },
      },
      create: {
        metricId: metric.id,
        window,
        bucketStart: bucket,
        value: durationMs,
        sampleCount: 1,
      },
      update: {
        value: { increment: durationMs },
        sampleCount: { increment: 1 },
      },
    });
  }

  async getPerformanceSummary() {
    const results = await Promise.all(
      PERFORMANCE_METRICS.map(async (code) => {
        const latest = await this.getLatestValue(code, 'REALTIME');
        return {
          code,
          latestValueMs: latest ? latest.value / latest.sampleCount : null,
          sampleCount: latest?.sampleCount ?? 0,
          bucketStart: latest?.bucketStart ?? null,
        };
      }),
    );
    return results;
  }
}
