import { Inject, Injectable } from '@nestjs/common';
import { AlertingService } from './alerting.service';
import { CapacityService } from './capacity.service';
import { HealthMonitorService } from './health-monitor.service';
import { IncidentService } from './incident.service';
import { MaintenanceService } from './maintenance.service';
import { MetricsService } from './metrics.service';
import { SloService } from './slo.service';

@Injectable()
export class OpsDashboardService {
  constructor(
    @Inject(AlertingService) private readonly alerts: AlertingService,
    @Inject(IncidentService) private readonly incidents: IncidentService,
    @Inject(HealthMonitorService) private readonly health: HealthMonitorService,
    @Inject(MaintenanceService) private readonly maintenance: MaintenanceService,
    @Inject(SloService) private readonly slos: SloService,
    @Inject(CapacityService) private readonly capacity: CapacityService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  async overview() {
    const [openAlerts, openIncidents, services, notices, sloList, capacityLatest, metricSummary] =
      await Promise.all([
        this.alerts.listAlerts('OPEN', 20),
        this.incidents.list({ status: 'OPEN', take: 20 }),
        this.health.serviceStatusMap(),
        this.maintenance.listActive(),
        this.slos.list(),
        this.capacity.latestByService(),
        this.metrics.summaryByDomain(),
      ]);

    const unhealthy = services.filter((s) => s.status !== 'HEALTHY');
    return {
      generatedAt: new Date().toISOString(),
      openAlertCount: openAlerts.total,
      openIncidentCount: openIncidents.total,
      unhealthyServiceCount: unhealthy.length,
      openAlerts: openAlerts.items,
      openIncidents: openIncidents.items,
      services,
      maintenanceNotices: notices,
      slos: sloList,
      capacity: capacityLatest,
      metricsByDomain: metricSummary,
    };
  }

  async publicStatus() {
    const [services, notices, incidents] = await Promise.all([
      this.health.serviceStatusMap(),
      this.maintenance.listActive(),
      this.incidents.list({ publicOnly: true, take: 20 }),
    ]);
    const overall = services.some((s) => s.status === 'UNHEALTHY')
      ? 'UNHEALTHY'
      : services.some((s) => s.status === 'DEGRADED')
        ? 'DEGRADED'
        : 'HEALTHY';
    return {
      overall,
      generatedAt: new Date().toISOString(),
      services: services.map((s) => ({ serviceName: s.serviceName, status: s.status })),
      maintenanceNotices: notices,
      incidents: incidents.items.map((i) => ({
        code: i.code,
        title: i.title,
        status: i.status,
        severity: i.severity,
        startedAt: i.startedAt,
      })),
    };
  }
}
