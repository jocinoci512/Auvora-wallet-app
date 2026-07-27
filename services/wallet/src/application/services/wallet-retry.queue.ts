import { Injectable, Logger } from '@nestjs/common';

export type RetryJob = {
  walletId: string;
  reason: string;
  attempts: number;
  enqueuedAt: string;
};

/**
 * In-memory retry queue for failed wallet syncs (Phase 18).
 * Survives within a process; Redis-backed queue can replace later without API breaks.
 */
@Injectable()
export class WalletRetryQueue {
  private readonly logger = new Logger(WalletRetryQueue.name);
  private readonly queue: RetryJob[] = [];
  private readonly maxSize = 1_000;

  enqueue(job: Omit<RetryJob, 'enqueuedAt'>): void {
    if (this.queue.length >= this.maxSize) {
      this.queue.shift();
    }
    this.queue.push({ ...job, enqueuedAt: new Date().toISOString() });
    this.logger.debug(`Retry enqueued wallet=${job.walletId} attempts=${job.attempts}`);
  }

  drain(limit = 25): RetryJob[] {
    return this.queue.splice(0, limit);
  }

  size(): number {
    return this.queue.length;
  }

  peek(): RetryJob[] {
    return [...this.queue];
  }
}
