import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { AlertingService } from './alerting.service';

@Injectable()
export class AlertWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertWorkerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(AlertingService) private readonly alerting: AlertingService,
  ) {}

  onModuleInit(): void {
    if (!this.env.OBSERVABILITY_ALERT_WORKER_ENABLED) {
      this.logger.log('Alert worker disabled');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, this.env.OBSERVABILITY_ALERT_POLL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  status() {
    return {
      enabled: this.env.OBSERVABILITY_ALERT_WORKER_ENABLED,
      running: this.timer != null,
    };
  }

  private async tick(): Promise<void> {
    try {
      const result = await this.alerting.evaluateEnabledRules();
      if (result.fired > 0) {
        this.logger.warn(`Alert worker fired ${result.fired} alert(s)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Alert worker tick failed: ${message}`);
    }
  }
}
