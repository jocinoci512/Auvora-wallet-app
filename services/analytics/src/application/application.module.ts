import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AggregationService } from './services/aggregation.service';
import { AggregationWorkerService } from './services/aggregation-worker.service';
import { AuditService } from './services/audit.service';
import { DashboardService } from './services/dashboard.service';
import { EventIngestService } from './services/event-ingest.service';
import { ForecastService } from './services/forecast.service';
import { InsightsService } from './services/insights.service';
import { KpiService } from './services/kpi.service';
import { MetricsService } from './services/metrics.service';
import { ReportService } from './services/report.service';
import { ScheduledReportService } from './services/scheduled-report.service';

const SERVICES = [
  AuditService,
  EventIngestService,
  MetricsService,
  AggregationService,
  AggregationWorkerService,
  KpiService,
  DashboardService,
  ReportService,
  ScheduledReportService,
  ForecastService,
  InsightsService,
];

@Module({
  imports: [InfrastructureModule],
  providers: [...SERVICES],
  exports: [...SERVICES],
})
export class ApplicationModule {}
