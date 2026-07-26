import {
  comparePriorityOrder,
  computeBackoffDelayMs,
  hasExceededMaxAttempts,
  resolveFailureOutcome,
  sortByPriorityOrder,
} from './queue-policy';

describe('queue-policy', () => {
  it('computes exponential backoff delays that double each attempt', () => {
    expect(computeBackoffDelayMs(1, { baseDelayMs: 1000 })).toBe(1000);
    expect(computeBackoffDelayMs(2, { baseDelayMs: 1000 })).toBe(2000);
    expect(computeBackoffDelayMs(3, { baseDelayMs: 1000 })).toBe(4000);
  });

  it('caps backoff delay at the configured maximum', () => {
    expect(computeBackoffDelayMs(10, { baseDelayMs: 1000, maxDelayMs: 5000 })).toBe(5000);
  });

  it('flags max attempts exceeded once the attempt count reaches the limit', () => {
    expect(hasExceededMaxAttempts(4, { maxAttempts: 5 })).toBe(false);
    expect(hasExceededMaxAttempts(5, { maxAttempts: 5 })).toBe(true);
  });

  it('resolves RETRY with a future nextAttemptAt below the max attempts', () => {
    const outcome = resolveFailureOutcome(1, { maxAttempts: 5, baseDelayMs: 1000 });
    expect(outcome.outcome).toBe('RETRY');
    expect(outcome.nextAttemptAt).toBeInstanceOf(Date);
    expect(outcome.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('resolves DEAD_LETTER once attempts are exhausted', () => {
    const outcome = resolveFailureOutcome(5, { maxAttempts: 5 });
    expect(outcome.outcome).toBe('DEAD_LETTER');
    expect(outcome.nextAttemptAt).toBeUndefined();
  });

  it('orders CRITICAL before HIGH before NORMAL before LOW', () => {
    const now = new Date();
    const items = [
      { priority: 'LOW' as const, createdAt: now },
      { priority: 'CRITICAL' as const, createdAt: now },
      { priority: 'NORMAL' as const, createdAt: now },
      { priority: 'HIGH' as const, createdAt: now },
    ];
    const sorted = sortByPriorityOrder(items);
    expect(sorted.map((i) => i.priority)).toEqual(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']);
  });

  it('preserves FIFO order within the same priority', () => {
    const older = { priority: 'NORMAL' as const, createdAt: new Date(Date.now() - 10_000) };
    const newer = { priority: 'NORMAL' as const, createdAt: new Date() };
    expect(comparePriorityOrder(older, newer)).toBeLessThan(0);
    expect(sortByPriorityOrder([newer, older])).toEqual([older, newer]);
  });
});
