import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { QueueService } from './queue.service';

/** Background poller that repeatedly claims and delivers queued notifications. Disabled in tests to avoid open handles. */
@Injectable()
export class QueueWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueWorkerService.name);
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private ticking = false;

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  onModuleInit(): void {
    if (this.env.NODE_ENV === 'test' || !this.env.NOTIFICATIONS_QUEUE_WORKER_ENABLED) {
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

  status() {
    return {
      enabled: this.env.NOTIFICATIONS_QUEUE_WORKER_ENABLED && this.env.NODE_ENV !== 'test',
      running: this.timer != null && !this.stopped,
    };
  }

  private async tick(): Promise<void> {
    if (this.ticking || this.stopped) return;
    this.ticking = true;
    try {
      let result = await this.queue.processNext('queue-worker');
      // Drain the batch quickly rather than waiting a full poll interval between each item.
      while (!this.stopped && result.processed) {
        result = await this.queue.processNext('queue-worker');
      }
    } catch (error) {
      this.logger.error(
        `Queue worker tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.ticking = false;
    }
  }
}
