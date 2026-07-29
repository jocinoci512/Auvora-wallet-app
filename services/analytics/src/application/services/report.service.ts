import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type ReportFormat, type Prisma } from '@auvora/database';
import {
  AnalyticsEventType,
  EVENT_BUS,
  exportReport,
  ForbiddenError,
  NotFoundError,
  type EventBusPort,
  type ReportRow,
} from '../../domain';
import {
  FIELD_ENCRYPTION,
  type FieldEncryptionPort,
} from '../../infrastructure/crypto/field-encryption.adapter';
import { CLOCK, type ClockPort } from '../ports/clock.port';
import { AuditService } from './audit.service';
import { MetricsService } from './metrics.service';

interface QuerySpec {
  metrics?: string[];
  window?: 'HOURLY' | 'DAILY' | 'MONTHLY';
}

@Injectable()
export class ReportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(FIELD_ENCRYPTION) private readonly encryption: FieldEncryptionPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listForUser(ownerUserId: string, skip = 0, take = 50) {
    const [items, total] = await Promise.all([
      this.prisma.analyticsReport.findMany({
        where: { ownerUserId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.analyticsReport.count({ where: { ownerUserId } }),
    ]);
    return { items, total };
  }

  async get(id: string, requesterId: string, isAdmin: boolean) {
    const report = await this.prisma.analyticsReport.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundError('Report not found');
    }
    if (!isAdmin && report.ownerUserId !== requesterId) {
      throw new ForbiddenError('Report access denied');
    }
    return report;
  }

  async getDecryptedResult(id: string, requesterId: string, isAdmin: boolean) {
    const report = await this.get(id, requesterId, isAdmin);
    if (!report.resultEncrypted) {
      return null;
    }
    const plaintext = this.encryption.decrypt(report.resultEncrypted);
    return JSON.parse(plaintext) as unknown;
  }

  private async buildRows(querySpec: QuerySpec): Promise<ReportRow[]> {
    const metricCodes = querySpec.metrics ?? [];
    const window = querySpec.window ?? 'DAILY';
    const rows: ReportRow[] = [];

    for (const metricCode of metricCodes) {
      const values = await this.metrics.getValues(metricCode, { window, take: 30 });
      for (const value of values) {
        rows.push({
          metricCode,
          window: value.window,
          bucketStart: value.bucketStart.toISOString(),
          value: value.value,
          sampleCount: value.sampleCount,
        });
      }
    }

    return rows;
  }

  async generate(input: {
    templateCode?: string;
    name: string;
    ownerUserId?: string;
    format?: ReportFormat;
    parameters?: Record<string, unknown>;
    correlationId?: string;
  }) {
    const started = Date.now();
    let querySpec: QuerySpec = { metrics: [], window: 'DAILY' };
    let templateId: string | undefined;

    try {
      if (input.templateCode) {
        const template = await this.prisma.reportTemplate.findUnique({
          where: { code: input.templateCode },
        });
        if (!template || !template.isEnabled) {
          throw new NotFoundError(`Report template not found: ${input.templateCode}`);
        }
        templateId = template.id;
        querySpec = template.querySpec as QuerySpec;
      }

      const format = input.format ?? 'JSON';
      const rows = await this.buildRows(querySpec);
      const exported = exportReport(format, rows);
      const serialized = typeof exported === 'string' ? exported : JSON.stringify(exported);
      const encrypted = this.encryption.encrypt(serialized);
      const checksum = this.encryption.hash(serialized);
      const now = this.clock.now();

      const report = await this.prisma.analyticsReport.create({
        data: {
          templateId,
          ownerUserId: input.ownerUserId,
          name: input.name,
          status: 'READY',
          format,
          parameters: (input.parameters ?? null) as Prisma.InputJsonValue,
          resultEncrypted: encrypted,
          resultChecksum: checksum,
          generatedAt: now,
          correlationId: input.correlationId,
        },
      });

      await this.events.publish({
        type: AnalyticsEventType.ReportGenerated,
        aggregateId: report.id,
        correlationId: input.correlationId,
        payload: { format, rowCount: rows.length },
      });
      await this.audit.record('report.generated', {
        actorUserId: input.ownerUserId,
        resourceType: 'analytics_report',
        resourceId: report.id,
        correlationId: input.correlationId,
        details: { format, templateCode: input.templateCode },
      });

      return { report, rowCount: rows.length };
    } finally {
      await this.metrics.recordDuration('report_generate_ms', Date.now() - started);
    }
  }
}
