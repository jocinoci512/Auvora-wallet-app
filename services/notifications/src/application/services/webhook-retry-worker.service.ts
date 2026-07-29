import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { WebhookService } from './webhook.service';

/** Background poller that repeatedly claims and dispatches due webhook retries. Disabled in tests to avoid open handles. */
@Injectable()
export class WebhookRetryWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookRetryWorkerService.name);
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private ticking = false;

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(WebhookService) private readonly webhooks: WebhookService,
  ) {}

  onModuleInit(): void {
    if (this.env.NODE_ENV === 'test' || !this.env.NOTIFICATIONS_WEBHOOK_WORKER_ENABLED) {
      return;
    }
    this.stopped = false;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.env.NOTIFICATIONS_QUEUE_POLL_INTERVAL_MS);
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
    if (this.ticking || this.stopped) return;
    this.ticking = true;
    try {
      let result = await this.webhooks.processNextRetry('webhook-retry-worker');
      // Drain the batch quickly rather than waiting a full poll interval between each item.
      while (!this.stopped && result.processed) {
        result = await this.webhooks.processNextRetry('webhook-retry-worker');
      }
    } catch (error) {
      this.logger.error(
        `Webhook retry worker tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.ticking = false;
    }
  }
}
