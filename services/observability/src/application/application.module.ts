import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AlertWorkerService } from './services/alert-worker.service';
import { AlertingService } from './services/alerting.service';
import { AuditService } from './services/audit.service';
import { CapacityService } from './services/capacity.service';
import { DependencyService } from './services/dependency.service';
import { HealthMonitorService } from './services/health-monitor.service';
import { IncidentService } from './services/incident.service';
import { LoggingService } from './services/logging.service';
import { MaintenanceService } from './services/maintenance.service';
import { MetricsService } from './services/metrics.service';
import { OpsDashboardService } from './services/ops-dashboard.service';
import { InfrastructureService } from './services/infrastructure.service';
import { SloService } from './services/slo.service';
import { TelemetryIngestService } from './services/telemetry-ingest.service';
import { TracingService } from './services/tracing.service';

const SERVICES = [
  AuditService,
  TelemetryIngestService,
  MetricsService,
  TracingService,
  LoggingService,
  HealthMonitorService,
  DependencyService,
  AlertingService,
  AlertWorkerService,
  IncidentService,
  SloService,
  CapacityService,
  MaintenanceService,
  OpsDashboardService,
  InfrastructureService,
];

@Module({
  imports: [InfrastructureModule],
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class ApplicationModule {}
