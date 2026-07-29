import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type ReportFormat, type Prisma } from '@auvora/database';
import { computeNextRunAt, normalizeCronExpression, NotFoundError } from '../../domain';
import { CLOCK, type ClockPort } from '../ports/clock.port';
import { ReportService } from './report.service';

function computeRetryDelayMs(attemptCount: number): number {
  const baseMs = 60_000;
  return Math.min(3_600_000, baseMs * 2 ** Math.max(0, attemptCount - 1));
}

@Injectable()
export class ScheduledReportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReportService) private readonly reports: ReportService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async list(ownerUserId?: string) {
    return this.prisma.scheduledReport.findMany({
      where: { ownerUserId },
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: {
    templateCode: string;
    name: string;
    ownerUserId?: string;
    cronExpression: string;
    format?: ReportFormat;
    parameters?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const template = await this.prisma.reportTemplate.findUnique({
      where: { code: input.templateCode },
    });
    if (!template || !template.isEnabled) {
      throw new NotFoundError(`Report template not found: ${input.templateCode}`);
    }

    const cronExpression = normalizeCronExpression(input.cronExpression);
    const nextRunAt = computeNextRunAt(cronExpression, this.clock.now());

    return this.prisma.scheduledReport.create({
      data: {
        templateId: template.id,
        ownerUserId: input.ownerUserId,
        name: input.name,
        cronExpression,
        format: input.format ?? template.defaultFormat,
        parameters: (input.parameters ?? null) as Prisma.InputJsonValue,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
        nextRunAt,
        status: 'ACTIVE',
      },
      include: { template: true },
    });
  }

  async pause(id: string) {
    return this.prisma.scheduledReport.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
  }

  async resume(id: string) {
    const current = await this.prisma.scheduledReport.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundError('Scheduled report not found');
    }
    return this.prisma.scheduledReport.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        nextRunAt: computeNextRunAt(current.cronExpression, this.clock.now()),
        attemptCount: 0,
        lastError: null,
        nextAttemptAt: null,
      },
    });
  }

  async processDueReports(limit = 20): Promise<number> {
    const now = this.clock.now();
    const due = await this.prisma.scheduledReport.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ nextAttemptAt: { lte: now } }, { nextAttemptAt: null, nextRunAt: { lte: now } }],
      },
      include: { template: true },
      take: limit,
    });

    for (const scheduled of due) {
      try {
        await this.reports.generate({
          templateCode: scheduled.template.code,
          name: `${scheduled.name} (${now.toISOString()})`,
          ownerUserId: scheduled.ownerUserId ?? undefined,
          format: scheduled.format,
          parameters: (scheduled.parameters as Record<string, unknown> | null) ?? undefined,
        });
        await this.prisma.scheduledReport.update({
          where: { id: scheduled.id },
          data: {
            lastRunAt: now,
            nextRunAt: computeNextRunAt(scheduled.cronExpression, now),
            attemptCount: 0,
            lastError: null,
            nextAttemptAt: null,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const attemptCount = scheduled.attemptCount + 1;
        const exhausted = attemptCount >= scheduled.maxAttempts;
        await this.prisma.scheduledReport.update({
          where: { id: scheduled.id },
          data: exhausted
            ? {
                status: 'FAILED',
                attemptCount,
                lastError: message,
                nextAttemptAt: null,
              }
            : {
                attemptCount,
                lastError: message,
                nextAttemptAt: new Date(now.getTime() + computeRetryDelayMs(attemptCount)),
              },
        });
      }
    }

    return due.length;
  }
}
