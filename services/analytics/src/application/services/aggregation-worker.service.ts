import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { AggregationService } from './aggregation.service';
import { ScheduledReportService } from './scheduled-report.service';

@Injectable()
export class AggregationWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AggregationWorkerService.name);
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private ticking = false;

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(AggregationService) private readonly aggregation: AggregationService,
    @Inject(ScheduledReportService) private readonly scheduledReports: ScheduledReportService,
  ) {}

  onModuleInit(): void {
    if (this.env.NODE_ENV === 'test' || !this.env.ANALYTICS_AGGREGATION_WORKER_ENABLED) {
      return;
    }
    this.stopped = false;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.env.ANALYTICS_AGGREGATION_POLL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick(): Promise<void> {
    if (this.ticking || this.stopped) {
      return;
    }
    this.ticking = true;
    try {
      await this.aggregation.processPendingEvents();
      await this.scheduledReports.processDueReports();
    } catch (error) {
      this.logger.error(
        `Aggregation worker tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.ticking = false;
    }
  }
}
