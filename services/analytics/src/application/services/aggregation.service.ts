import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type AggregationWindow,
  type AnalyticsDomain,
  type Prisma,
} from '@auvora/database';
import {
  AggregationError,
  AnalyticsEventType,
  bucketStart,
  defaultWindowsForMetric,
  EVENT_BUS,
  parseMetricSnapshot,
  type EventBusPort,
} from '../../domain';
import { CLOCK, type ClockPort } from '../ports/clock.port';
import { AuditService } from './audit.service';
import { MetricsService } from './metrics.service';

export interface RunAggregationOptions {
  window?: AggregationWindow;
  domain?: AnalyticsDomain;
  limit?: number;
}

@Injectable()
export class AggregationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  async run(options: RunAggregationOptions = {}) {
    const started = Date.now();
    const limit = options.limit ?? 500;
    const job = await this.prisma.aggregationJob.create({
      data: {
        jobType: 'event_metrics',
        window: options.window ?? 'HOURLY',
        status: 'RUNNING',
        domain: options.domain,
        startedAt: this.clock.now(),
      },
    });

    try {
      const processedCount = await this.processPendingEvents(limit, options.domain);
      const completed = await this.prisma.aggregationJob.update({
        where: { id: job.id },
        data: {
          status: 'SUCCEEDED',
          processedCount,
          completedAt: this.clock.now(),
        },
      });

      await this.events.publish({
        type: AnalyticsEventType.AggregationCompleted,
        aggregateId: job.id,
        payload: { processedCount, window: options.window ?? 'HOURLY' },
      });
      await this.audit.record('aggregation.completed', {
        resourceType: 'aggregation_job',
        resourceId: job.id,
        details: { processedCount },
      });

      return completed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.aggregationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: message,
          completedAt: this.clock.now(),
        },
      });
      await this.events.publish({
        type: AnalyticsEventType.AggregationFailed,
        aggregateId: job.id,
        payload: { error: message },
      });
      throw new AggregationError(message);
    } finally {
      await this.metrics.recordDuration('aggregation_duration_ms', Date.now() - started);
    }
  }

  async processPendingEvents(limit = 500, domain?: AnalyticsDomain): Promise<number> {
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        processedAt: null,
        domain,
      },
      orderBy: { occurredAt: 'asc' },
      take: limit,
    });

    if (events.length === 0) {
      return 0;
    }

    const metricDefinitions = await this.prisma.metricDefinition.findMany({
      where: { isEnabled: true },
    });
    const metricByCode = new Map(metricDefinitions.map((metric) => [metric.code, metric]));
    const now = this.clock.now();

    for (const event of events) {
      const snapshots = parseMetricSnapshot(event.metrics);
      for (const [metricCode, value] of Object.entries(snapshots)) {
        const definition = metricByCode.get(metricCode);
        if (!definition) {
          continue;
        }
        for (const window of defaultWindowsForMetric()) {
          const start = bucketStart(event.occurredAt, window);
          await this.prisma.metricValue.upsert({
            where: {
              metricId_window_bucketStart: {
                metricId: definition.id,
                window,
                bucketStart: start,
              },
            },
            create: {
              metricId: definition.id,
              window,
              bucketStart: start,
              value,
              sampleCount: 1,
              dimensions: { domain: event.domain } as Prisma.InputJsonValue,
            },
            update: {
              value: { increment: value },
              sampleCount: { increment: 1 },
            },
          });
        }
      }

      await this.prisma.analyticsEvent.update({
        where: { id: event.id },
        data: { processedAt: now },
      });
    }

    return events.length;
  }
}
