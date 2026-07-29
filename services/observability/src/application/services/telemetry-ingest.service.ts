import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type ObsMetricKind,
  type ObsServiceDomain,
  type Prisma,
} from '@auvora/database';
import { maskSensitiveString, maskSensitiveValue } from '../../domain';
import { AuditService } from './audit.service';

export interface MetricSampleInput {
  code: string;
  name?: string;
  domain: ObsServiceDomain;
  kind?: ObsMetricKind;
  unit?: string;
  serviceName: string;
  value: number;
  labels?: Record<string, unknown>;
  correlationId?: string;
  observedAt?: Date;
}

export interface TraceIngestInput {
  traceId: string;
  rootService?: string;
  rootOperation?: string;
  correlationId?: string;
  statusCode?: string;
  durationMs?: number;
  startedAt: Date;
  endedAt?: Date;
  metadata?: Record<string, unknown>;
  spans: Array<{
    spanId: string;
    parentSpanId?: string;
    serviceName: string;
    operationName: string;
    statusCode?: string;
    durationMs?: number;
    startedAt: Date;
    endedAt?: Date;
    attributes?: Record<string, unknown>;
  }>;
}

export interface LogIngestInput {
  serviceName: string;
  domain?: ObsServiceDomain;
  level: string;
  message: string;
  payload?: Record<string, unknown>;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  isImmutable?: boolean;
  retentionDays?: number;
  occurredAt?: Date;
}

export interface HealthIngestInput {
  serviceName: string;
  checkName: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
  latencyMs?: number;
  details?: Record<string, unknown>;
  checkedAt?: Date;
}

export interface CapacityIngestInput {
  serviceName: string;
  domain?: ObsServiceDomain;
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
  networkMbps?: number;
  dbGrowthMb?: number;
  storageGrowthMb?: number;
  txThroughput?: number;
  queueDepth?: number;
  forecastLoad?: number;
  labels?: Record<string, unknown>;
  observedAt?: Date;
}

@Injectable()
export class TelemetryIngestService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async ingestMetric(input: MetricSampleInput) {
    const definition = await this.prisma.obsMetricDefinition.upsert({
      where: { code: input.code },
      create: {
        code: input.code,
        name: input.name ?? input.code,
        domain: input.domain,
        kind: input.kind ?? 'GAUGE',
        unit: input.unit,
      },
      update: {
        name: input.name ?? undefined,
        isEnabled: true,
      },
    });

    const sample = await this.prisma.obsMetricSample.create({
      data: {
        metricId: definition.id,
        serviceName: input.serviceName,
        value: input.value,
        labels: (input.labels ?? null) as Prisma.InputJsonValue,
        correlationId: input.correlationId,
        observedAt: input.observedAt ?? new Date(),
      },
    });

    return { definition, sample };
  }

  async ingestMetrics(inputs: MetricSampleInput[]) {
    const results = [];
    for (const input of inputs) {
      results.push(await this.ingestMetric(input));
    }
    await this.audit.record('telemetry.metrics_ingested', { details: { count: results.length } });
    return { count: results.length };
  }

  async ingestTrace(input: TraceIngestInput) {
    const trace = await this.prisma.obsTrace.upsert({
      where: { traceId: input.traceId },
      create: {
        traceId: input.traceId,
        rootService: input.rootService,
        rootOperation: input.rootOperation,
        correlationId: input.correlationId,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
        spans: {
          create: input.spans.map((span) => ({
            spanId: span.spanId,
            parentSpanId: span.parentSpanId,
            serviceName: span.serviceName,
            operationName: span.operationName,
            statusCode: span.statusCode,
            durationMs: span.durationMs,
            startedAt: span.startedAt,
            endedAt: span.endedAt,
            attributes: (span.attributes ?? null) as Prisma.InputJsonValue,
          })),
        },
      },
      update: {
        durationMs: input.durationMs,
        endedAt: input.endedAt,
        statusCode: input.statusCode,
      },
      include: { spans: true },
    });
    await this.audit.record('telemetry.trace_ingested', {
      resourceType: 'obs_trace',
      resourceId: trace.id,
      correlationId: input.correlationId,
    });
    return trace;
  }

  async ingestLog(input: LogIngestInput) {
    const entry = await this.prisma.obsLogEntry.create({
      data: {
        serviceName: input.serviceName,
        domain: input.domain ?? 'SYSTEM',
        level: input.level,
        message: maskSensitiveString(input.message),
        payload: (input.payload
          ? maskSensitiveValue(input.payload)
          : null) as Prisma.InputJsonValue,
        correlationId: input.correlationId,
        traceId: input.traceId,
        spanId: input.spanId,
        isMasked: true,
        isImmutable: input.isImmutable ?? false,
        retentionDays: input.retentionDays ?? 30,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
    return entry;
  }

  async ingestHealth(input: HealthIngestInput) {
    return this.prisma.obsHealthCheck.create({
      data: {
        serviceName: input.serviceName,
        checkName: input.checkName,
        status: input.status,
        latencyMs: input.latencyMs,
        details: (input.details ?? null) as Prisma.InputJsonValue,
        checkedAt: input.checkedAt ?? new Date(),
      },
    });
  }

  async ingestCapacity(input: CapacityIngestInput) {
    return this.prisma.obsCapacitySample.create({
      data: {
        serviceName: input.serviceName,
        domain: input.domain ?? 'INFRASTRUCTURE',
        cpuPercent: input.cpuPercent,
        memoryPercent: input.memoryPercent,
        diskPercent: input.diskPercent,
        networkMbps: input.networkMbps,
        dbGrowthMb: input.dbGrowthMb,
        storageGrowthMb: input.storageGrowthMb,
        txThroughput: input.txThroughput,
        queueDepth: input.queueDepth,
        forecastLoad: input.forecastLoad,
        labels: (input.labels ?? null) as Prisma.InputJsonValue,
        observedAt: input.observedAt ?? new Date(),
      },
    });
  }
}
