import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type ObsAlertSeverity,
  type ObsServiceDomain,
  type Prisma,
} from '@auvora/database';
import { evaluateThreshold, type AlertComparison, NotFoundError } from '../../domain';
import { AuditService } from './audit.service';

@Injectable()
export class AlertingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  listRules() {
    return this.prisma.obsAlertRule.findMany({ orderBy: { code: 'asc' } });
  }

  createRule(input: {
    code: string;
    name: string;
    description?: string;
    domain: ObsServiceDomain;
    metricCode?: string;
    ruleType?: string;
    severity?: ObsAlertSeverity;
    threshold?: number;
    comparison?: string;
    windowSeconds?: number;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.obsAlertRule.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        domain: input.domain,
        metricCode: input.metricCode,
        ruleType: input.ruleType ?? 'threshold',
        severity: input.severity ?? 'WARNING',
        threshold: input.threshold,
        comparison: input.comparison ?? 'gt',
        windowSeconds: input.windowSeconds ?? 300,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
      },
    });
  }

  async updateRule(
    code: string,
    input: {
      name?: string;
      description?: string;
      metricCode?: string;
      ruleType?: string;
      severity?: ObsAlertSeverity;
      threshold?: number;
      comparison?: string;
      windowSeconds?: number;
      isEnabled?: boolean;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.getRule(code);
    const updated = await this.prisma.obsAlertRule.update({
      where: { code },
      data: {
        name: input.name,
        description: input.description,
        metricCode: input.metricCode,
        ruleType: input.ruleType,
        severity: input.severity,
        threshold: input.threshold,
        comparison: input.comparison,
        windowSeconds: input.windowSeconds,
        isEnabled: input.isEnabled,
        metadata: input.metadata === undefined ? undefined : (input.metadata as Prisma.InputJsonValue),
      },
    });
    await this.audit.record('alert_rule.updated', {
      resourceType: 'obs_alert_rule',
      resourceId: updated.id,
      details: { code, isEnabled: updated.isEnabled },
    });
    return updated;
  }

  async listAlerts(status?: string, take = 50) {
    const where = status ? { status: status as never } : undefined;
    const [items, total] = await Promise.all([
      this.prisma.obsAlert.findMany({ where, orderBy: { firedAt: 'desc' }, take }),
      this.prisma.obsAlert.count({ where }),
    ]);
    return { items, total };
  }

  async acknowledge(id: string, userId: string) {
    const alert = await this.prisma.obsAlert.update({
      where: { id },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: userId },
    });
    await this.audit.record('alert.acknowledged', { actorUserId: userId, resourceId: id });
    return alert;
  }

  async resolve(id: string, userId: string) {
    const alert = await this.prisma.obsAlert.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: userId },
    });
    await this.audit.record('alert.resolved', { actorUserId: userId, resourceId: id });
    return alert;
  }

  async evaluateEnabledRules() {
    const rules = await this.prisma.obsAlertRule.findMany({ where: { isEnabled: true } });
    const fired = [];
    for (const rule of rules) {
      if (!rule.metricCode || rule.threshold == null) {
        continue;
      }
      const metric = await this.prisma.obsMetricDefinition.findUnique({ where: { code: rule.metricCode } });
      if (!metric) {
        continue;
      }
      const since = new Date(Date.now() - rule.windowSeconds * 1000);
      const samples = await this.prisma.obsMetricSample.findMany({
        where: { metricId: metric.id, observedAt: { gte: since } },
        orderBy: { observedAt: 'desc' },
        take: 100,
      });
      if (!samples.length) {
        continue;
      }
      const avg = samples.reduce((sum, s) => sum + s.value, 0) / samples.length;
      const comparison = (rule.comparison ?? 'gt') as AlertComparison;
      if (!evaluateThreshold(avg, rule.threshold, comparison)) {
        continue;
      }
      const alert = await this.prisma.obsAlert.create({
        data: {
          ruleId: rule.id,
          code: `${rule.code}.${Date.now()}`,
          title: rule.name,
          message: `Metric ${rule.metricCode} avg=${avg.toFixed(2)} breached threshold ${rule.threshold}`,
          severity: rule.severity,
          serviceName: samples[0]?.serviceName,
          metadata: { avg, sampleCount: samples.length } as Prisma.InputJsonValue,
        },
      });
      fired.push(alert);
    }
    return { evaluated: rules.length, fired: fired.length, alerts: fired };
  }

  async getRule(code: string) {
    const rule = await this.prisma.obsAlertRule.findUnique({ where: { code } });
    if (!rule) {
      throw new NotFoundError(`Alert rule ${code} not found`);
    }
    return rule;
  }
}
