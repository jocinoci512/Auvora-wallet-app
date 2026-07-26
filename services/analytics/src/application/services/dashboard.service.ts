import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type AnalyticsDomain,
  type DashboardVisibility,
  type Prisma,
} from '@auvora/database';
import { ForbiddenError, NotFoundError } from '../../domain';
import { MetricsService } from './metrics.service';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  async listForUser(ownerUserId: string, filters: { domain?: AnalyticsDomain } = {}) {
    const started = Date.now();
    try {
      return await this.prisma.analyticsDashboard.findMany({
        where: {
          domain: filters.domain,
          isEnabled: true,
          OR: [
            { visibility: 'SYSTEM' },
            { visibility: 'ORGANIZATION' },
            { ownerUserId },
          ],
        },
        include: { widgets: true },
        orderBy: { code: 'asc' },
      });
    } finally {
      await this.metrics.recordDuration('dashboard_load_ms', Date.now() - started);
    }
  }

  async listSystem(filters: { domain?: AnalyticsDomain } = {}) {
    const started = Date.now();
    try {
      return await this.prisma.analyticsDashboard.findMany({
        where: {
          domain: filters.domain,
          isSystem: true,
          isEnabled: true,
        },
        include: { widgets: true },
        orderBy: { code: 'asc' },
      });
    } finally {
      await this.metrics.recordDuration('dashboard_load_ms', Date.now() - started);
    }
  }

  async getByCode(code: string) {
    const started = Date.now();
    try {
      const dashboard = await this.prisma.analyticsDashboard.findUnique({
        where: { code },
        include: { widgets: { orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }] } },
      });
      if (!dashboard) {
        throw new NotFoundError(`Dashboard not found: ${code}`);
      }
      return dashboard;
    } finally {
      await this.metrics.recordDuration('dashboard_load_ms', Date.now() - started);
    }
  }

  assertReadable(
    dashboard: { ownerUserId: string | null; visibility: DashboardVisibility },
    requesterId: string,
    isAdmin: boolean,
  ): void {
    if (isAdmin || dashboard.visibility === 'SYSTEM' || dashboard.visibility === 'ORGANIZATION') {
      return;
    }
    if (dashboard.visibility === 'SHARED') {
      if (dashboard.ownerUserId === requesterId) {
        return;
      }
      throw new ForbiddenError('Dashboard access denied');
    }
    if (dashboard.ownerUserId === requesterId) {
      return;
    }
    throw new ForbiddenError('Dashboard access denied');
  }

  async create(input: {
    code: string;
    name: string;
    description?: string;
    domain?: AnalyticsDomain;
    ownerUserId: string;
    layout?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.analyticsDashboard.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        domain: input.domain,
        ownerUserId: input.ownerUserId,
        visibility: 'PRIVATE',
        layout: (input.layout ?? null) as Prisma.InputJsonValue,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
      },
      include: { widgets: true },
    });
  }

  async addWidget(
    dashboardCode: string,
    input: {
      title: string;
      widgetType: string;
      metricCode?: string;
      kpiCode?: string;
      config?: Record<string, unknown>;
      positionX?: number;
      positionY?: number;
      width?: number;
      height?: number;
    },
  ) {
    const dashboard = await this.getByCode(dashboardCode);
    return this.prisma.dashboardWidget.create({
      data: {
        dashboardId: dashboard.id,
        title: input.title,
        widgetType: input.widgetType,
        metricCode: input.metricCode,
        kpiCode: input.kpiCode,
        config: (input.config ?? null) as Prisma.InputJsonValue,
        positionX: input.positionX ?? 0,
        positionY: input.positionY ?? 0,
        width: input.width ?? 4,
        height: input.height ?? 2,
      },
    });
  }

  async adminMetrics() {
    const started = Date.now();
    try {
      const [events, metrics, kpis, dashboards, reports, jobs] = await Promise.all([
        this.prisma.analyticsEvent.count(),
        this.prisma.metricDefinition.count({ where: { isEnabled: true } }),
        this.prisma.kpiDefinition.count({ where: { isEnabled: true } }),
        this.prisma.analyticsDashboard.count({ where: { isEnabled: true } }),
        this.prisma.analyticsReport.count(),
        this.prisma.aggregationJob.count({ where: { status: 'PENDING' } }),
      ]);
      return { events, metrics, kpis, dashboards, reports, pendingAggregationJobs: jobs };
    } finally {
      await this.metrics.recordDuration('dashboard_load_ms', Date.now() - started);
    }
  }
}
