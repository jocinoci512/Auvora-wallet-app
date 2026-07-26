export type NotificationPriorityCode = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

const PRIORITY_WEIGHT: Record<NotificationPriorityCode, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export interface QueueBackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
}

export const DEFAULT_BACKOFF_OPTIONS: Required<QueueBackoffOptions> = {
  baseDelayMs: 1_000,
  maxDelayMs: 15 * 60 * 1_000,
  maxAttempts: 5,
};

/** Exponential backoff (base * 2^(attempt-1)), capped at maxDelayMs. `attempt` is the attempt number that just failed (1-based). */
export function computeBackoffDelayMs(attempt: number, options: QueueBackoffOptions = {}): number {
  const { baseDelayMs, maxDelayMs } = { ...DEFAULT_BACKOFF_OPTIONS, ...options };
  if (attempt < 1) {
    return baseDelayMs;
  }
  const delay = baseDelayMs * 2 ** (attempt - 1);
  return Math.min(delay, maxDelayMs);
}

export function computeNextAttemptAt(now: Date, attempt: number, options: QueueBackoffOptions = {}): Date {
  return new Date(now.getTime() + computeBackoffDelayMs(attempt, options));
}

export function hasExceededMaxAttempts(attemptCount: number, options: QueueBackoffOptions = {}): boolean {
  const { maxAttempts } = { ...DEFAULT_BACKOFF_OPTIONS, ...options };
  return attemptCount >= maxAttempts;
}

/** Whether a queue item that just failed should be retried or moved to the dead letter state. */
export function resolveFailureOutcome(
  attemptCount: number,
  options: QueueBackoffOptions = {},
): { outcome: 'RETRY' | 'DEAD_LETTER'; nextAttemptAt?: Date } {
  if (hasExceededMaxAttempts(attemptCount, options)) {
    return { outcome: 'DEAD_LETTER' };
  }
  return { outcome: 'RETRY', nextAttemptAt: computeNextAttemptAt(new Date(), attemptCount, options) };
}

export function priorityWeight(priority: NotificationPriorityCode): number {
  return PRIORITY_WEIGHT[priority];
}

export interface QueueOrderable {
  priority: NotificationPriorityCode;
  createdAt: Date;
}

/** Orders queue items by priority (CRITICAL first) then FIFO within the same priority. */
export function comparePriorityOrder<T extends QueueOrderable>(a: T, b: T): number {
  const weightDiff = priorityWeight(a.priority) - priorityWeight(b.priority);
  if (weightDiff !== 0) return weightDiff;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export function sortByPriorityOrder<T extends QueueOrderable>(items: T[]): T[] {
  return [...items].sort(comparePriorityOrder);
}
